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
		putCourse: async (course) => {
			current = {
				...current,
				courses: [...current.courses.filter(({ id }) => id !== course.id), course]
			};
		},
		putSession: async (session) => {
			current = {
				...current,
				sessions: [...current.sessions.filter(({ id }) => id !== session.id), session]
			};
		},
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
		deleteCourse: async (courseId) => {
			current = {
				...current,
				courses: current.courses.filter(({ id }) => id !== courseId),
				sessions: current.sessions.filter(({ courseId: id }) => id !== courseId)
			};
		},
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

function observationDraft(note: string, workspaceId = PERSONAL_WORKSPACE_ID) {
	return {
		observation: {
			workspaceId,
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

	it('creates, edits and archives a course, then creates and edits its first session', async () => {
		const personal = repository(PERSONAL_WORKSPACE_ID);
		const state = createTeacherFlowState({ repositoryFactory: async () => personal, clock });
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);

		await state.saveCourse({
			workspaceId: DEMO_WORKSPACE_ID,
			name: 'Mathématiques',
			subject: 'Algèbre',
			colorToken: 'moss'
		});
		const createdCourse = state.snapshot.courses[0]!;
		expect(createdCourse).toMatchObject({
			workspaceId: PERSONAL_WORKSPACE_ID,
			name: 'Mathématiques'
		});

		await state.saveCourse({ ...createdCourse, name: 'Mathématiques appliquées' }, createdCourse);
		expect(state.snapshot.courses[0]).toMatchObject({ name: 'Mathématiques appliquées' });

		await state.saveSession({
			workspaceId: DEMO_WORKSPACE_ID,
			courseId: createdCourse.id,
			title: 'Première séance',
			scheduledFor: '2026-08-18T09:00:00.000Z'
		});
		const createdSession = state.snapshot.sessions[0]!;
		await state.saveSession(
			{ ...createdSession, title: 'Première séance ajustée' },
			createdSession
		);
		expect(state.snapshot.sessions[0]).toMatchObject({
			workspaceId: PERSONAL_WORKSPACE_ID,
			title: 'Première séance ajustée'
		});

		await state.archiveCourse(createdCourse);
		expect(state.snapshot.courses[0]?.archivedAt).toBe('2026-08-15T09:00:00.000Z');
	});

	it('refuses to archive a course object from another workspace', async () => {
		const personal = repository(PERSONAL_WORKSPACE_ID);
		const state = createTeacherFlowState({ repositoryFactory: async () => personal, clock });
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);

		await state.archiveCourse({
			id: 'demo-course',
			workspaceId: DEMO_WORKSPACE_ID,
			name: 'Cours de démonstration',
			colorToken: 'moss',
			createdAt: '2026-08-15T09:00:00.000Z',
			updatedAt: '2026-08-15T09:00:00.000Z'
		});

		expect(state.snapshot.courses).toEqual([]);
		expect(state.status).toMatchObject({ kind: 'error' });
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

	it('refreshes the current repository when an old same-workspace commit lands after reactivation', async () => {
		const oldCommit = deferred<void>();
		const oldStarted = deferred<void>();
		let shared = empty(PERSONAL_WORKSPACE_ID);
		const oldPersonal = repository(PERSONAL_WORKSPACE_ID);
		oldPersonal.load = async () => shared;
		oldPersonal.putObservationWithDecision = async (observation, decision) => {
			oldStarted.resolve();
			await oldCommit.promise;
			shared = {
				...shared,
				observations: [...shared.observations, observation],
				decisions: decision ? [...shared.decisions, decision] : shared.decisions
			};
		};
		const currentPersonal = repository(PERSONAL_WORKSPACE_ID);
		currentPersonal.load = async () => shared;
		const demo = repository(DEMO_WORKSPACE_ID);
		let personalOpenCount = 0;
		const state = createTeacherFlowState({
			repositoryFactory: async (workspaceId) => {
				if (workspaceId === DEMO_WORKSPACE_ID) return demo;
				personalOpenCount += 1;
				return personalOpenCount === 1 ? oldPersonal : currentPersonal;
			},
			clock
		});
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);

		const oldSave = state.saveObservationFlow(observationDraft('Commit A après retour sur A.'));
		await oldStarted.promise;
		await state.switchWorkspace(DEMO_WORKSPACE_ID);
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		expect(state.snapshot.observations).toEqual([]);

		oldCommit.resolve();
		await oldSave;

		expect(state.snapshot.observations.map(({ note }) => note)).toEqual([
			'Commit A après retour sur A.'
		]);
		expect(state.status).toBeUndefined();
		expect(state.draft).toBeUndefined();
		expect(state.phase).toBe('ready');
	});

	it('reloads activation when an old same-workspace commit lands during its load', async () => {
		const oldCommit = deferred<void>();
		const oldStarted = deferred<void>();
		const activationLoadStarted = deferred<void>();
		const releaseActivationLoad = deferred<void>();
		let shared = empty(PERSONAL_WORKSPACE_ID);
		const oldPersonal = repository(PERSONAL_WORKSPACE_ID);
		oldPersonal.load = async () => shared;
		oldPersonal.putObservationWithDecision = async (observation, decision) => {
			oldStarted.resolve();
			await oldCommit.promise;
			shared = {
				...shared,
				observations: [...shared.observations, observation],
				decisions: decision ? [...shared.decisions, decision] : shared.decisions
			};
		};
		const currentPersonal = repository(PERSONAL_WORKSPACE_ID);
		let activationLoads = 0;
		currentPersonal.load = async () => {
			activationLoads += 1;
			if (activationLoads > 1) return shared;
			const capturedBeforeCommit = shared;
			activationLoadStarted.resolve();
			await releaseActivationLoad.promise;
			return capturedBeforeCommit;
		};
		const demo = repository(DEMO_WORKSPACE_ID);
		let personalOpenCount = 0;
		const state = createTeacherFlowState({
			repositoryFactory: async (workspaceId) => {
				if (workspaceId === DEMO_WORKSPACE_ID) return demo;
				personalOpenCount += 1;
				return personalOpenCount === 1 ? oldPersonal : currentPersonal;
			},
			clock
		});
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		const oldSave = state.saveObservationFlow(observationDraft('Commit A pendant load A.'));
		await oldStarted.promise;
		await state.switchWorkspace(DEMO_WORKSPACE_ID);

		const reactivation = state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		await activationLoadStarted.promise;
		oldCommit.resolve();
		await oldSave;
		releaseActivationLoad.resolve();
		await reactivation;

		expect(activationLoads).toBe(2);
		expect(state.snapshot.observations.map(({ note }) => note)).toEqual([
			'Commit A pendant load A.'
		]);
		expect(state.status).toBeUndefined();
		expect(state.draft).toBeUndefined();
		expect(state.phase).toBe('ready');
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

	it('publishes an earlier committed snapshot when the latest queued mutation fails', async () => {
		const personal = repository(PERSONAL_WORKSPACE_ID);
		const committedWrite = personal.putObservationWithDecision;
		personal.putObservationWithDecision = async (observation, decision) => {
			if (observation.note === 'M2 échoue avant commit.') throw new StorageFull();
			await committedWrite(observation, decision);
		};
		const state = createTeacherFlowState({ repositoryFactory: async () => personal, clock });
		await state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		const firstDraft = observationDraft('M1 est commitée.');
		const latestDraft = observationDraft('M2 échoue avant commit.');

		await Promise.all([
			state.saveObservationFlow(firstDraft),
			state.saveObservationFlow(latestDraft)
		]);

		expect(state.snapshot.observations.map(({ note }) => note)).toEqual(['M1 est commitée.']);
		expect(state.status).toMatchObject({
			kind: 'error',
			message: new StorageFull().recoveryInstruction
		});
		expect(state.draft).toEqual(latestDraft);
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

	it('retains an exact draft saved while workspace activation is pending', async () => {
		const opening = deferred<TeacherFlowRepository>();
		const state = createTeacherFlowState({ repositoryFactory: async () => opening.promise, clock });
		const draft = observationDraft('Saisie pendant le chargement.', DEMO_WORKSPACE_ID);

		const hydration = state.hydrate();
		await state.saveObservationFlow(draft);
		expect(state.draft).toEqual(draft);
		expect(state.status).toMatchObject({
			kind: 'error',
			message: expect.stringMatching(/Réessayez/u)
		});
		opening.resolve(repository(DEMO_WORKSPACE_ID));
		await hydration;
		expect(state.draft).toEqual(draft);
	});

	it('retains an exact draft after workspace activation has failed', async () => {
		const state = createTeacherFlowState({
			repositoryFactory: async () => {
				throw new StorageFull();
			},
			clock
		});
		const draft = observationDraft('Saisie après échec du stockage.', DEMO_WORKSPACE_ID);

		await state.hydrate();
		await state.saveObservationFlow(draft);

		expect(state.phase).toBe('error');
		expect(state.draft).toEqual(draft);
		expect(state.status).toMatchObject({
			kind: 'error',
			message: expect.stringMatching(/Réessayez/u)
		});
	});
	it('does not retain a late demo draft while personal workspace activation is pending', async () => {
		const personalOpening = deferred<TeacherFlowRepository>();
		const demo = repository(DEMO_WORKSPACE_ID);
		const state = createTeacherFlowState({
			repositoryFactory: async (workspaceId) =>
				workspaceId === DEMO_WORKSPACE_ID ? demo : personalOpening.promise,
			clock
		});
		await state.hydrate();

		const switching = state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		await state.saveObservationFlow(observationDraft('Brouillon démo tardif.', DEMO_WORKSPACE_ID));
		expect(state.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
		expect(state.draft).toBeUndefined();
		personalOpening.resolve(repository(PERSONAL_WORKSPACE_ID));
		await switching;
		expect(state.draft).toBeUndefined();
		expect(state.status).toBeUndefined();
	});

	it('retains a personal draft while personal workspace activation is pending', async () => {
		const opening = deferred<TeacherFlowRepository>();
		const state = createTeacherFlowState({ repositoryFactory: async () => opening.promise, clock });
		const draft = observationDraft('Brouillon personnel pendant chargement.');

		const switching = state.switchWorkspace(PERSONAL_WORKSPACE_ID);
		await state.saveObservationFlow(draft);
		expect(state.draft).toEqual(draft);
		opening.resolve(repository(PERSONAL_WORKSPACE_ID));
		await switching;
		expect(state.draft).toEqual(draft);
	});
});
