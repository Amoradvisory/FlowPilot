import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type {
	Course,
	Decision,
	Observation,
	Session,
	WorkspaceSnapshot
} from '../../../src/lib/teacherflow/domain/types';
import { openTeacherFlowRepository } from '../../../src/lib/teacherflow/data/repository';
import { createDemoSeed } from '../../../src/lib/teacherflow/demo/seed';

const now = '2026-08-15T09:00:00.000Z';
const names: string[] = [];

function databaseName(): string {
	const name = `teacherflow-repository-${crypto.randomUUID()}`;
	names.push(name);
	return name;
}

function course(workspaceId = 'personal'): Course {
	return {
		id: 'course',
		workspaceId,
		name: 'Mathématiques',
		colorToken: 'indigo',
		createdAt: now,
		updatedAt: now
	};
}
function session(workspaceId = 'personal'): Session {
	return {
		id: 'session',
		workspaceId,
		courseId: 'course',
		title: 'Fractions',
		status: 'planned',
		createdAt: now,
		updatedAt: now
	};
}
function observation(workspaceId = 'personal'): Observation {
	return {
		id: 'observation',
		workspaceId,
		sessionId: 'session',
		signal: 'adjust',
		note: 'Revoir le vocabulaire.',
		createdAt: now,
		updatedAt: now
	};
}
function decision(workspaceId = 'personal'): Decision {
	return {
		id: 'decision',
		workspaceId,
		observationId: 'observation',
		text: 'Ajouter un exemple.',
		status: 'to_prepare',
		createdAt: now,
		updatedAt: now
	};
}

afterEach(async () => {
	await Promise.all(names.splice(0).map((name) => indexedDB.deleteDatabase(name)));
});

describe('TeacherFlowRepository', () => {
	it('keeps workspaces isolated and persists through a second repository instance', async () => {
		const name = databaseName();
		const personal = await openTeacherFlowRepository('personal', {
			databaseName: name,
			migrateLegacy: false
		});
		await personal.putCourse(course());
		await personal.putSession(session());
		const demo = await openTeacherFlowRepository('demo', {
			databaseName: name,
			migrateLegacy: false
		});
		await demo.putCourse(course('demo'));
		expect((await personal.load()).courses.map(({ workspaceId }) => workspaceId)).toEqual([
			'personal'
		]);
		expect((await demo.load()).courses.map(({ workspaceId }) => workspaceId)).toEqual(['demo']);
		const reopened = await openTeacherFlowRepository('personal', {
			databaseName: name,
			migrateLegacy: false
		});
		expect(await reopened.load()).toMatchObject({ courses: [course()], sessions: [session()] });
	});

	it('enforces references, writes observation and decision atomically, and cascades course deletion', async () => {
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: databaseName(),
			migrateLegacy: false
		});
		await expect(repo.putSession(session())).rejects.toMatchObject({ code: 'relation_not_found' });
		await repo.putCourse(course());
		await repo.putSession(session());
		await repo.putObservationWithDecision(observation(), decision());
		expect(await repo.load()).toMatchObject({
			observations: [observation()],
			decisions: [decision()]
		});
		await repo.deleteCourse('course');
		expect(await repo.load()).toEqual({
			workspaceId: 'personal',
			courses: [],
			sessions: [],
			observations: [],
			decisions: []
		});
	});

	it('leaves the previous snapshot unchanged when a replacement fails validation', async () => {
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: databaseName(),
			migrateLegacy: false
		});
		await repo.putCourse(course());
		const before = await repo.load();
		const invalid: WorkspaceSnapshot = {
			...before,
			sessions: [{ ...session(), courseId: 'missing-course' }]
		};
		await expect(repo.replaceWorkspace(invalid)).rejects.toMatchObject({
			code: 'relation_not_found'
		});
		expect(await repo.load()).toEqual(before);
	});

	it('replaces a coherent workspace atomically', async () => {
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: databaseName(),
			migrateLegacy: false
		});
		const nextCourse = { ...course(), id: 'replacement-course', name: 'Physique' };
		await repo.replaceWorkspace({
			workspaceId: 'personal',
			courses: [nextCourse],
			sessions: [],
			observations: [],
			decisions: []
		});
		expect(await repo.load()).toEqual({
			workspaceId: 'personal',
			courses: [nextCourse],
			sessions: [],
			observations: [],
			decisions: []
		});
	});

	it('keeps a pre-import recovery backup and rolls back byte-for-byte if importing fails', async () => {
		const name = databaseName();
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: name,
			migrateLegacy: false
		});
		await repo.putCourse(course());
		const before = await repo.load();
		const invalid: WorkspaceSnapshot = {
			...before,
			sessions: [{ ...session(), courseId: 'missing' }]
		};
		await expect(repo.importPersonalWorkspace(invalid, '1.0.0')).rejects.toMatchObject({
			code: 'relation_not_found'
		});
		expect(await repo.load()).toEqual(before);

		await repo.importPersonalWorkspace(
			{ workspaceId: 'personal', courses: [], sessions: [], observations: [], decisions: [] },
			'1.0.0'
		);
		const database = new (
			await import('../../../src/lib/teacherflow/data/database')
		).TeacherFlowDatabase(name);
		await database.open();
		const recovery = await database.recoveryBackups
			.where('workspaceId')
			.equals('personal')
			.toArray();
		expect(recovery).toHaveLength(1);
		expect(JSON.parse(recovery[0]!.raw)).toEqual(before);
		await database.close();
	});

	it('rolls back an import that fails after the replacement transaction has started', async () => {
		const name = databaseName();
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: name,
			migrateLegacy: false,
			afterImportClear: () => {
				throw new Error('forced failure after import clear');
			}
		});
		await repo.replaceWorkspace({
			workspaceId: 'personal',
			courses: [course()],
			sessions: [session()],
			observations: [observation()],
			decisions: [decision()]
		});
		const before = await repo.load();

		await expect(
			repo.importPersonalWorkspace(
				{
					workspaceId: 'personal',
					courses: [{ ...course(), id: 'replacement', name: 'Sciences' }],
					sessions: [],
					observations: [],
					decisions: []
				},
				'1.0.0'
			)
		).rejects.toThrow('forced failure after import clear');
		expect(await repo.load()).toEqual(before);

		const database = new (
			await import('../../../src/lib/teacherflow/data/database')
		).TeacherFlowDatabase(name);
		await database.open();
		expect(await database.recoveryBackups.where('workspaceId').equals('personal').count()).toBe(0);
		await database.close();
	});

	it('clears observations with their decisions, preserves external decisions by clearing their target, and reset prevents legacy reimport', async () => {
		const name = databaseName();
		const storage = {
			getItem: (key: string) =>
				key === 'teacherflow-public-demo-observations-v1'
					? JSON.stringify([
							{ id: 'legacy', signal: 'worked', note: 'Ancienne note', capturedAt: now }
						])
					: null
		};
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: name,
			storage
		});
		expect(repo.migration).toMatchObject({ recovered: 1, backupCreated: true });
		const sourceSession = { ...session(), scheduledFor: '2026-08-16T09:00:00.000Z' };
		const secondCourse = { ...course(), id: 'course-two', name: 'Sciences' };
		const target = {
			...session(),
			id: 'target',
			courseId: secondCourse.id,
			scheduledFor: '2026-08-16T09:00:00.000Z'
		};
		const externalObservation = {
			...observation(),
			id: 'external-observation',
			sessionId: target.id
		};
		const externalDecision = {
			...decision(),
			id: 'external-decision',
			observationId: externalObservation.id,
			targetSessionId: 'session'
		};
		await repo.replaceWorkspace({
			workspaceId: 'personal',
			courses: [course(), secondCourse],
			sessions: [sourceSession, target],
			observations: [observation(), externalObservation],
			decisions: [decision(), externalDecision]
		});
		await repo.deleteObservation('observation');
		expect((await repo.load()).decisions.map(({ id }) => id)).toEqual(['external-decision']);
		await repo.deleteCourse('course');
		expect((await repo.load()).decisions[0]).not.toHaveProperty('targetSessionId');
		await repo.clearWorkspace();
		expect(await repo.load()).toEqual({
			workspaceId: 'personal',
			courses: [],
			sessions: [],
			observations: [],
			decisions: []
		});
		const database = new (
			await import('../../../src/lib/teacherflow/data/database')
		).TeacherFlowDatabase(name);
		await database.open();
		expect(await database.recoveryBackups.where('workspaceId').equals('personal').count()).toBe(0);
		await database.close();
		const reopened = await openTeacherFlowRepository('personal', { databaseName: name, storage });
		expect(reopened.migration).toMatchObject({ alreadyApplied: true, recovered: 0 });
		expect(await reopened.load()).toEqual({
			workspaceId: 'personal',
			courses: [],
			sessions: [],
			observations: [],
			decisions: []
		});
	});

	it('rolls back linked observation and decision writes after the first write fails', async () => {
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: databaseName(),
			migrateLegacy: false,
			afterLinkedWrite: () => {
				throw new Error('forced linked-write failure');
			}
		});
		await repo.putCourse(course());
		await repo.putSession(session());
		const before = await repo.load();
		await expect(repo.putObservationWithDecision(observation(), decision())).rejects.toThrow(
			'forced linked-write failure'
		);
		expect(await repo.load()).toEqual(before);
	});

	it('edits an observation without a decision as a single atomic write', async () => {
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: databaseName(),
			migrateLegacy: false,
			afterLinkedWrite: () => {
				throw new Error('a second linked write must not run');
			}
		});
		await repo.replaceWorkspace({
			workspaceId: 'personal',
			courses: [course()],
			sessions: [session()],
			observations: [observation()],
			decisions: []
		});

		const result = await repo.editObservationWithDecision({
			observationId: 'observation',
			expectedObservationUpdatedAt: now,
			observation: {
				workspaceId: 'personal',
				sessionId: 'session',
				signal: 'keep',
				note: 'Le vocabulaire est désormais maîtrisé.'
			},
			now: () => new Date('2026-08-15T09:00:01.000Z')
		});

		expect(result).not.toHaveProperty('decision');
		expect(await repo.load()).toMatchObject({
			observations: [
				{
					id: 'observation',
					signal: 'keep',
					note: 'Le vocabulaire est désormais maîtrisé.',
					updatedAt: '2026-08-15T09:00:01.000Z'
				}
			],
			decisions: []
		});
	});

	it('keeps the personal export marker and detects deletion, import, and reset mutations', async () => {
		const name = databaseName();
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: name,
			migrateLegacy: false
		});
		await repo.putCourse(course());
		const firstExport = '2026-08-15T09:05:00.000Z';
		await repo.markPersonalExportedAt(firstExport);
		expect(await repo.lastPersonalExportedAt()).toBe(firstExport);
		expect(await repo.hasPersonalChangesSinceLastExport()).toBe(false);

		await repo.deleteCourse('course');
		expect(await repo.lastPersonalExportedAt()).toBe(firstExport);
		expect(await repo.hasPersonalChangesSinceLastExport()).toBe(true);

		const secondExport = '2026-08-15T09:10:00.000Z';
		await repo.markPersonalExportedAt(secondExport);
		expect(await repo.hasPersonalChangesSinceLastExport()).toBe(false);
		await repo.importPersonalWorkspace(
			{
				workspaceId: 'personal',
				courses: [course()],
				sessions: [],
				observations: [],
				decisions: []
			},
			'1.0.0'
		);
		expect(await repo.hasPersonalChangesSinceLastExport()).toBe(true);

		const thirdExport = '2026-08-15T09:15:00.000Z';
		await repo.markPersonalExportedAt(thirdExport);
		await repo.clearWorkspace();
		expect(await repo.lastPersonalExportedAt()).toBe(thirdExport);
		expect(await repo.hasPersonalChangesSinceLastExport()).toBe(true);
		const restored = {
			workspaceId: 'personal' as const,
			courses: [course()],
			sessions: [session()],
			observations: [observation()],
			decisions: [decision()]
		};
		await repo.importPersonalWorkspace(restored, '1.0.0');
		expect(await repo.load()).toEqual(restored);

		const demo = await openTeacherFlowRepository('demo', {
			databaseName: name,
			migrateLegacy: false
		});
		expect(await demo.lastPersonalExportedAt()).toBeUndefined();
		expect(await demo.hasPersonalChangesSinceLastExport()).toBe(false);
	});

	it('seeds a new demo once and preserves a deliberately cleared demo on reopening', async () => {
		const name = databaseName();
		const seed = createDemoSeed(() => new Date(now));
		const storedSeed = {
			...seed,
			sessions: [...seed.sessions].sort((left, right) => left.id.localeCompare(right.id))
		};
		const first = await openTeacherFlowRepository('demo', {
			databaseName: name,
			migrateLegacy: false
		});
		await first.ensureDemoSeed(seed);
		expect(await first.load()).toEqual(storedSeed);

		const reopened = await openTeacherFlowRepository('demo', {
			databaseName: name,
			migrateLegacy: false
		});
		await reopened.ensureDemoSeed(seed);
		expect(await reopened.load()).toEqual(storedSeed);

		await reopened.clearWorkspace();
		const cleared = await openTeacherFlowRepository('demo', {
			databaseName: name,
			migrateLegacy: false
		});
		await cleared.ensureDemoSeed(seed);
		expect(await cleared.load()).toEqual({
			workspaceId: 'demo',
			courses: [],
			sessions: [],
			observations: [],
			decisions: []
		});
		await cleared.replaceWorkspace(seed);
		const resetReopened = await openTeacherFlowRepository('demo', {
			databaseName: name,
			migrateLegacy: false
		});
		await resetReopened.ensureDemoSeed(seed);
		expect(await resetReopened.load()).toEqual(storedSeed);
	});
});
