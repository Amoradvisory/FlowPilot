import { describe, expect, it } from 'vitest';
import {
	exportWorkspace,
	parseTeacherFlowBackup,
	serializeTeacherFlowBackup,
	TEACHERFLOW_BACKUP_MAX_BYTES
} from '../../../src/lib/teacherflow/data/backup';
import type { WorkspaceSnapshot } from '../../../src/lib/teacherflow/domain/types';

const at = '2026-08-15T10:00:00.000Z';

function personalSnapshot(): WorkspaceSnapshot {
	return {
		workspaceId: 'personal',
		courses: [
			{
				id: 'course',
				workspaceId: 'personal',
				name: 'Maths',
				colorToken: 'blue',
				createdAt: at,
				updatedAt: at
			}
		],
		sessions: [
			{
				id: 'session',
				workspaceId: 'personal',
				courseId: 'course',
				title: 'Fractions',
				status: 'planned',
				scheduledFor: '2026-08-16T10:00:00.000Z',
				createdAt: at,
				updatedAt: at
			}
		],
		observations: [
			{
				id: 'observation',
				workspaceId: 'personal',
				sessionId: 'session',
				signal: 'adjust',
				note: 'Ajouter un exemple.',
				createdAt: at,
				updatedAt: at
			}
		],
		decisions: [
			{
				id: 'decision',
				workspaceId: 'personal',
				observationId: 'observation',
				targetSessionId: 'session',
				text: 'Préparer un exemple.',
				status: 'to_prepare',
				createdAt: at,
				updatedAt: at
			}
		]
	};
}

describe('TeacherFlow personal backup', () => {
	it('creates a versioned personal-only round trip', () => {
		const backup = exportWorkspace(personalSnapshot(), '1.2.3');
		expect(backup).toMatchObject({
			format: 'teacherflow-backup',
			formatVersion: 1,
			appVersion: '1.2.3',
			workspaceId: 'personal'
		});
		expect(parseTeacherFlowBackup(JSON.stringify(backup))).toEqual({ ok: true, value: backup });
	});

	it('rejects a non-canonical application version', () => {
		expect(() => exportWorkspace(personalSnapshot(), ' 1.2.3 ')).toThrow();
		const backup = exportWorkspace(personalSnapshot(), '1.2.3');
		expect(
			parseTeacherFlowBackup(JSON.stringify({ ...backup, appVersion: ' 1.2.3 ' }))
		).toMatchObject({ ok: false });
	});

	it('rejects non-personal export, malformed JSON, oversized UTF-8 input and invalid domain content', () => {
		expect(() => exportWorkspace({ ...personalSnapshot(), workspaceId: 'demo' }, '1')).toThrow();
		expect(parseTeacherFlowBackup('{')).toMatchObject({ ok: false });
		expect(parseTeacherFlowBackup('é'.repeat(TEACHERFLOW_BACKUP_MAX_BYTES))).toMatchObject({
			ok: false,
			reason: 'too_large'
		});
		const backup = exportWorkspace(personalSnapshot(), '1');
		expect(
			parseTeacherFlowBackup(
				JSON.stringify({
					...backup,
					observations: [{ ...backup.observations[0], signal: 'invented' }]
				})
			)
		).toMatchObject({ ok: false });
		expect(
			parseTeacherFlowBackup(
				JSON.stringify({
					...backup,
					decisions: [{ ...backup.decisions[0], observationId: 'missing' }]
				})
			)
		).toMatchObject({ ok: false });
		expect(
			parseTeacherFlowBackup(
				JSON.stringify({
					...backup,
					sessions: [{ ...backup.sessions[0], scheduledFor: 'invalid-date' }]
				})
			)
		).toMatchObject({ ok: false });
	});

	it('rejects unknown or dangerous nested keys and does not mutate the snapshot while serializing', () => {
		const snapshot = personalSnapshot();
		const before = structuredClone(snapshot);
		const backup = exportWorkspace(snapshot, '1');
		const withUnknownCourseKey = JSON.stringify({
			...backup,
			courses: [{ ...backup.courses[0], unexpected: true }]
		});
		const withPrototypeKey = JSON.stringify({
			...backup,
			observations: [{ ...backup.observations[0], constructor: 'poison' }]
		});

		expect(parseTeacherFlowBackup(withUnknownCourseKey)).toMatchObject({
			ok: false,
			reason: 'invalid_structure'
		});
		expect(parseTeacherFlowBackup(withPrototypeKey)).toMatchObject({
			ok: false,
			reason: 'unsafe_key'
		});
		expect(snapshot).toEqual(before);
	});

	it('refuses to serialize a valid but oversized backup before it can be downloaded', () => {
		const snapshot = personalSnapshot();
		const observations = Array.from({ length: 1800 }, (_, index) => ({
			...snapshot.observations[0],
			id: `observation-${index}`,
			note: 'x'.repeat(600)
		}));
		const decisions = observations.map((observation, index) => ({
			...snapshot.decisions[0],
			id: `decision-${index}`,
			observationId: observation.id
		}));
		const backup = exportWorkspace({ ...snapshot, observations, decisions }, '1');
		expect(() => serializeTeacherFlowBackup(backup)).toThrow(/taille maximale/u);
	});
});
