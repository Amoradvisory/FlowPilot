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
		},
		ensureDemoSeed: async () => {}
	};
}

function deferred<Value>() {
	let resolve!: (value: Value | PromiseLike<Value>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<Value>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return { promise, resolve, reject };
}

function observationDraft(note: string) {
	return {
		observation: {
			workspaceId: PERSONAL_WORKSPACE_ID,
			sessionId: 'session',
			signal: 'adjust' as const,
			note
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
		await Promise.resolve();
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

	it('ignores an old workspace save after switching while its write is pending', async () => {
		const pendingWrite = deferred<void>();
		const demo = repository(DEMO_WORKSPACE_ID);
		demo.putObservationWithDecision = () => pendingWrite.promise;
		const personal = repository(PERSONAL_WORKSPACE_ID);
		const state = createTeacherFlowState({
			repositoryFactory: async (workspaceId) =>
				workspaceId === DEMO_WORKSPACE_ID ? demo : personal,
			clock
		});
		await state.hydrate();

		const save = state.saveObservationFlow(observationDraft('Écriture ancienne.'));
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		pendingWrite.resolve();
		await save;

		expect(state.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
		expect(state.snapshot).toEqual(empty(PERSONAL_WORKSPACE_ID));
		expect(state.status).toBeUndefined();
		expect(state.draft).toBeUndefined();
	});

	it('ignores an old workspace reload after switching once its write has committed', async () => {
		const pendingReload = deferred<WorkspaceSnapshot>();
		let loads = 0;
		const demo = repository(DEMO_WORKSPACE_ID);
		demo.load = async () => {
			loads += 1;
			return loads === 1 ? empty(DEMO_WORKSPACE_ID) : pendingReload.promise;
		};
		const personal = repository(PERSONAL_WORKSPACE_ID);
		const state = createTeacherFlowState({
			repositoryFactory: async (workspaceId) =>
				workspaceId === DEMO_WORKSPACE_ID ? demo : personal,
			clock
		});
		await state.hydrate();

		const save = state.saveObservationFlow(observationDraft('Reload ancien.'));
		await Promise.resolve();
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		pendingReload.resolve(empty(DEMO_WORKSPACE_ID));
		await save;

		expect(state.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
		expect(state.snapshot).toEqual(empty(PERSONAL_WORKSPACE_ID));
		expect(state.status).toBeUndefined();
	});

	it('serializes concurrent saves and only announces the current mutation after its reload', async () => {
		const firstWrite = deferred<void>();
		const secondWrite = deferred<void>();
		const secondStarted = deferred<void>();
		const writes: string[] = [];
		const personal = repository(PERSONAL_WORKSPACE_ID);
		personal.putObservationWithDecision = async (observation) => {
			writes.push(observation.note);
			if (writes.length === 1) return firstWrite.promise;
			secondStarted.resolve();
			return secondWrite.promise;
		};
		const state = createTeacherFlowState({ repositoryFactory: async () => personal, clock });
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);

		const first = state.saveObservationFlow(observationDraft('Première saisie.'));
		const second = state.saveObservationFlow(observationDraft('Deuxième saisie.'));
		expect(state.status).toBeUndefined();
		await Promise.resolve();
		expect(writes).toEqual(['Première saisie.']);
		firstWrite.resolve();
		await secondStarted.promise;
		expect(writes).toEqual(['Première saisie.', 'Deuxième saisie.']);
		expect(state.status).toBeUndefined();
		secondWrite.resolve();
		await Promise.all([first, second]);

		expect(state.status).toMatchObject({ kind: 'success', message: 'Enregistré localement' });
	});

	it('keeps a coherent phase for loading, degraded, and reload failures', async () => {
		const reload = deferred<WorkspaceSnapshot>();
		let loads = 0;
		const personal = repository(PERSONAL_WORKSPACE_ID);
		personal.load = async () => {
			loads += 1;
			return loads === 1 ? empty(PERSONAL_WORKSPACE_ID) : reload.promise;
		};
		const degraded = createTeacherFlowState({
			repositoryFactory: async () => personal,
			clock,
			network: () => false
		});
		expect(degraded.phase).toBe('loading');
		await degraded.switchWorkspace(PERSONAL_WORKSPACE_ID);
		expect(degraded.phase).toBe('degraded');
		const save = degraded.saveObservationFlow(observationDraft('Échec de relecture.'));
		await Promise.resolve();
		reload.reject(new StorageFull());
		await save;
		expect(degraded.phase).toBe('error');
		expect(degraded.status).toMatchObject({ kind: 'error' });
	});

	it('rejects an arbitrary workspace and never gives it to the repository factory', async () => {
		const opened: string[] = [];
		const state = createTeacherFlowState({
			repositoryFactory: async (workspaceId) => {
				opened.push(workspaceId);
				return repository(workspaceId);
			},
			clock
		});

		expect(() =>
			(state.switchWorkspace as (workspaceId: string) => Promise<void>)('other')
		).toThrow('Unknown TeacherFlow workspace');
		expect(opened).toEqual([]);
	});

	it('injects the active workspace instead of trusting a form workspace value', async () => {
		let savedWorkspaceId: string | undefined;
		const personal = repository(PERSONAL_WORKSPACE_ID);
		personal.putObservationWithDecision = async (observation) => {
			savedWorkspaceId = observation.workspaceId;
		};
		const state = createTeacherFlowState({ repositoryFactory: async () => personal, clock });
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);

		await state.saveObservationFlow({
			observation: {
				workspaceId: DEMO_WORKSPACE_ID,
				sessionId: 'session',
				signal: 'adjust',
				note: 'Le contrôleur fixe l’espace actif.'
			}
		});

		expect(savedWorkspaceId).toBe(PERSONAL_WORKSPACE_ID);
	});

	it('reaches ready after a coherent load and error when initial loading fails', async () => {
		const ready = createTeacherFlowState({
			repositoryFactory: async () => repository(PERSONAL_WORKSPACE_ID),
			clock
		});
		expect(ready.phase).toBe('loading');
		await ready.switchWorkspace(PERSONAL_WORKSPACE_ID);
		expect(ready.phase).toBe('ready');

		const failing = createTeacherFlowState({
			repositoryFactory: async () => {
				throw new StorageFull();
			},
			clock
		});
		await failing.switchWorkspace(PERSONAL_WORKSPACE_ID);
		expect(failing.phase).toBe('error');
		expect(failing.status).toMatchObject({ kind: 'error' });
	});
});
