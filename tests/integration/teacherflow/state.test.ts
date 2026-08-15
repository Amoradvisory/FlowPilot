import { describe, expect, it } from 'vitest';
import { StorageFull } from '../../../src/lib/teacherflow/data/errors';
import type { TeacherFlowRepository } from '../../../src/lib/teacherflow/data/repository';
import type { WorkspaceSnapshot } from '../../../src/lib/teacherflow/domain/types';
import {
	createDemoSeed,
	DEMO_WORKSPACE_ID,
	PERSONAL_WORKSPACE_ID
} from '../../../src/lib/teacherflow/demo/seed';
import { createTeacherFlowState } from '../../../src/lib/teacherflow/state/teacherflow-state.svelte';

const clock = () => new Date('2026-08-15T09:00:00.000Z');

function empty(workspaceId: string): WorkspaceSnapshot {
	return { workspaceId, courses: [], sessions: [], observations: [], decisions: [] };
}

function repository(workspaceId: string, snapshot = empty(workspaceId)): TeacherFlowRepository {
	let current = snapshot;
	return {
		workspaceId,
		migration: { recovered: 0, ignored: 0, backupCreated: false, alreadyApplied: false },
		load: async () => current,
		putCourse: async () => {},
		putSession: async () => {},
		putObservationWithDecision: async (observation, decision) => {
			current = {
				...current,
				observations: [...current.observations, observation],
				decisions: decision ? [...current.decisions, decision] : current.decisions
			};
		},
		putDecision: async (decision) => {
			current = { ...current, decisions: [...current.decisions, decision] };
		},
		deleteObservation: async () => {},
		deleteCourse: async () => {},
		replaceWorkspace: async (next) => {
			current = next;
		},
		clearWorkspace: async () => {
			current = empty(workspaceId);
		}
	};
}

describe('TeacherFlow state controller', () => {
	it('announces a local save only after the repository commit succeeds', async () => {
		let resolveWrite: (() => void) | undefined;
		const repo = repository(DEMO_WORKSPACE_ID);
		repo.putObservationWithDecision = () =>
			new Promise<void>((resolve) => {
				resolveWrite = resolve;
			});
		const state = createTeacherFlowState({ repositoryFactory: async () => repo, clock });
		await state.hydrate();

		const save = state.saveObservationFlow({
			observation: {
				workspaceId: DEMO_WORKSPACE_ID,
				sessionId: 'demo-session',
				signal: 'adjust',
				note: 'Prévoir un exemple avant la consigne.'
			}
		});
		expect(state.status?.message).not.toBe('Enregistré localement');
		resolveWrite?.();
		await save;
		expect(state.status).toMatchObject({ kind: 'success', message: 'Enregistré localement' });
	});

	it('retains the observation draft and shows the mapped recovery instruction after a failed save', async () => {
		const repo = repository(DEMO_WORKSPACE_ID);
		repo.putObservationWithDecision = async () => {
			throw new StorageFull();
		};
		const state = createTeacherFlowState({ repositoryFactory: async () => repo, clock });
		await state.hydrate();
		const draft = {
			observation: {
				workspaceId: DEMO_WORKSPACE_ID,
				sessionId: 'demo-session',
				signal: 'adjust' as const,
				note: 'Conserver cette saisie malgré la panne.'
			}
		};

		await state.saveObservationFlow(draft);
		expect(state.draft).toEqual(draft);
		expect(state.status).toMatchObject({
			kind: 'error',
			message: new StorageFull().recoveryInstruction
		});
	});

	it('loads each workspace through its own repository without leaking entities', async () => {
		const demo = repository(DEMO_WORKSPACE_ID, {
			...empty(DEMO_WORKSPACE_ID),
			courses: [
				{
					id: 'demo-only',
					workspaceId: DEMO_WORKSPACE_ID,
					name: 'Exemple',
					colorToken: 'moss',
					createdAt: '2026-08-15T09:00:00.000Z',
					updatedAt: '2026-08-15T09:00:00.000Z'
				}
			]
		});
		const personal = repository(PERSONAL_WORKSPACE_ID);
		const state = createTeacherFlowState({
			repositoryFactory: async (workspaceId) =>
				workspaceId === DEMO_WORKSPACE_ID ? demo : personal,
			clock
		});
		await state.hydrate();
		expect(state.snapshot.courses.map((course) => course.id)).toEqual(['demo-only']);

		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		expect(state.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
		expect(state.snapshot).toEqual(empty(PERSONAL_WORKSPACE_ID));
	});

	it('resets the demo deterministically and clears the personal workspace completely', async () => {
		const demo = repository(DEMO_WORKSPACE_ID);
		const personal = repository(PERSONAL_WORKSPACE_ID, {
			...empty(PERSONAL_WORKSPACE_ID),
			courses: [
				{
					id: 'personal-only',
					workspaceId: PERSONAL_WORKSPACE_ID,
					name: 'Brouillon personnel',
					colorToken: 'moss',
					createdAt: '2026-08-15T09:00:00.000Z',
					updatedAt: '2026-08-15T09:00:00.000Z'
				}
			]
		});
		const state = createTeacherFlowState({
			repositoryFactory: async (workspaceId) =>
				workspaceId === DEMO_WORKSPACE_ID ? demo : personal,
			clock
		});
		await state.hydrate();
		await state.resetDemo();
		expect(state.snapshot).toEqual(createDemoSeed(clock));

		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		await state.resetPersonal();
		expect(state.snapshot).toEqual(empty(PERSONAL_WORKSPACE_ID));
	});
});
