import { describe, expect, it } from 'vitest';
import {
	exportWorkspace,
	parseTeacherFlowBackup,
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
});
