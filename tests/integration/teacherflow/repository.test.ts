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
});
