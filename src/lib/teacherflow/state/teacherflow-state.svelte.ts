import { SvelteMap } from 'svelte/reactivity';
import { TeacherFlowStorageError } from '../data/errors';
import type { TeacherFlowRepository } from '../data/repository';
import { createDemoSeed, DEMO_WORKSPACE_ID, PERSONAL_WORKSPACE_ID } from '../demo/seed';
import { TEACHERFLOW_APP_VERSION } from '../version';
import {
	archiveCourse,
	createCourse,
	createDecision,
	createObservation,
	createSession,
	updateCourse,
	updateSession
} from '../domain/commands';
import { DomainError } from '../domain/invariants';
import { selectMemory, selectToday } from '../domain/selectors';
import type {
	Clock,
	Course,
	CourseDraft,
	DecisionDraft,
	Decision,
	MemoryFilters,
	ObservationDraft,
	Observation,
	Session,
	SessionDraft,
	WorkspaceSnapshot
} from '../domain/types';

export type TeacherFlowPhase = 'loading' | 'ready' | 'degraded' | 'error';
export type TeacherFlowStatus = { readonly kind: 'success' | 'error'; readonly message: string };
export type TeacherFlowWorkspaceId = typeof DEMO_WORKSPACE_ID | typeof PERSONAL_WORKSPACE_ID;

export interface ObservationFlowDraft {
	readonly observation: ObservationDraft;
	readonly decision?: Omit<DecisionDraft, 'workspaceId' | 'observationId'>;
}

export interface TeacherFlowStateOptions {
	readonly repositoryFactory: (
		workspaceId: TeacherFlowWorkspaceId
	) => Promise<TeacherFlowRepository>;
	readonly clock: Clock;
	/** Offline does not block local work; it only exposes the degraded network condition. */
	readonly network?: () => boolean;
}

export interface TeacherFlowState {
	readonly phase: TeacherFlowPhase;
	readonly workspaceId: TeacherFlowWorkspaceId;
	readonly snapshot: WorkspaceSnapshot;
	readonly draft?: ObservationFlowDraft;
	readonly status?: TeacherFlowStatus;
	readonly lastExportedAt?: string;
	readonly today: ReturnType<typeof selectToday>;
	memory(filters: MemoryFilters): ReturnType<typeof selectMemory>;
	hydrate(): Promise<void>;
	switchWorkspace(workspaceId: TeacherFlowWorkspaceId): Promise<void>;
	saveCourse(draft: CourseDraft, current?: Course): Promise<void>;
	archiveCourse(course: Course): Promise<void>;
	saveSession(draft: SessionDraft, current?: Session): Promise<void>;
	saveObservationFlow(draft: ObservationFlowDraft): Promise<void>;
	editObservationWithDecision(
		draft: ObservationDraft,
		current: Observation,
		decision?: Decision,
		decisionText?: string
	): Promise<boolean>;
	saveDecision(draft: DecisionDraft): Promise<void>;
	advanceDecision(decision: Decision): Promise<boolean>;
	deleteObservation(observationId: string): Promise<void>;
	deleteSession(sessionId: string): Promise<void>;
	deleteCourse(courseId: string): Promise<void>;
	resetDemo(): Promise<void>;
	resetPersonal(): Promise<void>;
	replacePersonal(snapshot: WorkspaceSnapshot): Promise<boolean>;
	markPersonalExportedAt(exportedAt: string): Promise<boolean>;
}

type MutationContext = {
	readonly workspaceEpoch: number;
	readonly workspaceId: TeacherFlowWorkspaceId;
	readonly repository: TeacherFlowRepository;
	readonly mutationEpoch: number;
};

type WorkspaceRevision = {
	committed: number;
	published: number;
};

const MAX_STABLE_LOAD_ATTEMPTS = 8;

function emptySnapshot(workspaceId: TeacherFlowWorkspaceId): WorkspaceSnapshot {
	return { workspaceId, courses: [], sessions: [], observations: [], decisions: [] };
}

function recoveryMessage(error: unknown): string {
	if (error instanceof TeacherFlowStorageError) return error.recoveryInstruction;
	return 'La modification n’a pas été enregistrée localement. Réessayez.';
}

function assertWorkspaceId(workspaceId: string): asserts workspaceId is TeacherFlowWorkspaceId {
	if (workspaceId !== DEMO_WORKSPACE_ID && workspaceId !== PERSONAL_WORKSPACE_ID) {
		throw new Error('Unknown TeacherFlow workspace');
	}
}

export function createTeacherFlowState(options: TeacherFlowStateOptions): TeacherFlowState {
	const values = new SvelteMap<string, unknown>([
		['phase', 'loading' satisfies TeacherFlowPhase],
		['workspaceId', DEMO_WORKSPACE_ID],
		['snapshot', emptySnapshot(DEMO_WORKSPACE_ID)],
		['lastExportedAt', undefined]
	]);
	let repository: TeacherFlowRepository | undefined;
	let workspaceEpoch = 0;
	let mutationEpoch = 0;
	let mutationQueue = Promise.resolve();
	const workspaceRevisions = new Map<TeacherFlowWorkspaceId, WorkspaceRevision>();

	const read = <Value>(key: string): Value => values.get(key) as Value;
	const write = <Value>(key: string, value: Value): void => {
		values.set(key, value);
	};

	function isOnline(): boolean {
		return options.network?.() ?? true;
	}

	function activationIsCurrent(epoch: number, workspaceId: TeacherFlowWorkspaceId): boolean {
		return workspaceEpoch === epoch && read<TeacherFlowWorkspaceId>('workspaceId') === workspaceId;
	}

	function captureMutation(): MutationContext | undefined {
		if (!repository) return undefined;
		return {
			workspaceEpoch,
			workspaceId: read<TeacherFlowWorkspaceId>('workspaceId'),
			repository,
			mutationEpoch: ++mutationEpoch
		};
	}

	function belongsToActiveWorkspace(context: MutationContext): boolean {
		return (
			workspaceEpoch === context.workspaceEpoch &&
			read<TeacherFlowWorkspaceId>('workspaceId') === context.workspaceId &&
			repository === context.repository
		);
	}

	function isLatestMutation(context: MutationContext): boolean {
		return belongsToActiveWorkspace(context) && mutationEpoch === context.mutationEpoch;
	}

	function revisionState(workspaceId: TeacherFlowWorkspaceId): WorkspaceRevision {
		const current = workspaceRevisions.get(workspaceId);
		if (current) return current;
		const initial = { committed: 0, published: 0 };
		workspaceRevisions.set(workspaceId, initial);
		return initial;
	}

	function markWorkspaceCommitted(workspaceId: TeacherFlowWorkspaceId): void {
		revisionState(workspaceId).committed += 1;
	}

	function markWorkspacePublished(workspaceId: TeacherFlowWorkspaceId, revision: number): void {
		const state = revisionState(workspaceId);
		state.published = Math.max(state.published, revision);
	}

	async function loadAndPublishStable(
		workspaceId: TeacherFlowWorkspaceId,
		activeRepository: TeacherFlowRepository,
		isRelevant: () => boolean,
		publish: (snapshot: WorkspaceSnapshot, revision: number) => void
	): Promise<boolean> {
		for (let attempt = 0; attempt < MAX_STABLE_LOAD_ATTEMPTS; attempt += 1) {
			const revisionBeforeLoad = revisionState(workspaceId).committed;
			const snapshot = await activeRepository.load();
			if (!isRelevant()) return false;
			const revisionAfterLoad = revisionState(workspaceId).committed;
			if (revisionBeforeLoad !== revisionAfterLoad) continue;
			if (!isRelevant()) return false;
			if (revisionState(workspaceId).committed !== revisionAfterLoad) continue;
			publish(snapshot, revisionAfterLoad);
			return true;
		}
		throw new Error('TeacherFlow data did not reach a stable revision while loading');
	}

	async function refreshActiveWorkspaceAfterCommit(
		workspaceId: TeacherFlowWorkspaceId
	): Promise<void> {
		if (read<TeacherFlowWorkspaceId>('workspaceId') !== workspaceId || !repository) return;
		const revision = revisionState(workspaceId);
		if (revision.published >= revision.committed) return;
		const activeEpoch = workspaceEpoch;
		const activeRepository = repository;
		const remainsActive = () =>
			workspaceEpoch === activeEpoch &&
			read<TeacherFlowWorkspaceId>('workspaceId') === workspaceId &&
			repository === activeRepository;
		await loadAndPublishStable(
			workspaceId,
			activeRepository,
			remainsActive,
			(snapshot, stableRevision) => {
				write('snapshot', snapshot);
				markWorkspacePublished(workspaceId, stableRevision);
			}
		);
	}

	function isDraftFromActiveWorkspace(draft: ObservationFlowDraft): boolean {
		const provenance = draft.observation.workspaceId;
		return (
			(provenance === DEMO_WORKSPACE_ID || provenance === PERSONAL_WORKSPACE_ID) &&
			provenance === read<TeacherFlowWorkspaceId>('workspaceId')
		);
	}

	function enqueueMutation(
		retainedDraft: ObservationFlowDraft | undefined,
		action: (context: MutationContext) => Promise<void>
	): Promise<boolean> {
		const draftToRetain =
			retainedDraft && isDraftFromActiveWorkspace(retainedDraft) ? retainedDraft : undefined;
		if (draftToRetain) write('draft', draftToRetain);
		const context = captureMutation();
		if (!context) {
			if (retainedDraft && !draftToRetain) return Promise.resolve(false);
			write('status', {
				kind: 'error',
				message: 'Le stockage local est encore en cours de préparation. Réessayez dans un instant.'
			} satisfies TeacherFlowStatus);
			return Promise.resolve(false);
		}
		write('status', undefined);
		write('lastExportedAt', undefined);
		const run = mutationQueue.then(async () => {
			let committed = false;
			try {
				await action(context);
				committed = true;
				markWorkspaceCommitted(context.workspaceId);
				await refreshActiveWorkspaceAfterCommit(context.workspaceId);
				if (!isLatestMutation(context)) return false;
				write('draft', undefined);
				write('status', {
					kind: 'success',
					message: 'Enregistré localement'
				} satisfies TeacherFlowStatus);
				write('phase', isOnline() ? 'ready' : 'degraded');
				return true;
			} catch (error) {
				if (!isLatestMutation(context)) return false;
				if (committed) write('phase', 'error' satisfies TeacherFlowPhase);
				if (draftToRetain) write('draft', draftToRetain);
				write('status', {
					kind: 'error',
					message: recoveryMessage(error)
				} satisfies TeacherFlowStatus);
				return false;
			}
		});
		mutationQueue = run.then(
			() => undefined,
			() => undefined
		);
		return run;
	}

	async function activate(nextWorkspaceId: TeacherFlowWorkspaceId): Promise<void> {
		const epoch = ++workspaceEpoch;
		mutationEpoch += 1;
		write('workspaceId', nextWorkspaceId);
		write('snapshot', emptySnapshot(nextWorkspaceId));
		write('draft', undefined);
		write('status', undefined);
		write('phase', 'loading' satisfies TeacherFlowPhase);
		repository = undefined;
		try {
			const nextRepository = await options.repositoryFactory(nextWorkspaceId);
			if (!activationIsCurrent(epoch, nextWorkspaceId)) return;
			if (nextWorkspaceId === DEMO_WORKSPACE_ID) {
				await nextRepository.ensureDemoSeed(createDemoSeed(options.clock));
				if (!activationIsCurrent(epoch, nextWorkspaceId)) return;
			}
			await loadAndPublishStable(
				nextWorkspaceId,
				nextRepository,
				() => activationIsCurrent(epoch, nextWorkspaceId),
				(snapshot, stableRevision) => {
					repository = nextRepository;
					write('snapshot', snapshot);
					markWorkspacePublished(nextWorkspaceId, stableRevision);
					write('phase', isOnline() ? 'ready' : 'degraded');
				}
			);
			if (
				activationIsCurrent(epoch, nextWorkspaceId) &&
				nextWorkspaceId === PERSONAL_WORKSPACE_ID
			) {
				const lastExportedAt = await nextRepository.lastPersonalExportedAt();
				if (activationIsCurrent(epoch, nextWorkspaceId)) write('lastExportedAt', lastExportedAt);
			}
		} catch (error) {
			if (!activationIsCurrent(epoch, nextWorkspaceId)) return;
			write('phase', 'error' satisfies TeacherFlowPhase);
			write('status', {
				kind: 'error',
				message: recoveryMessage(error)
			} satisfies TeacherFlowStatus);
		}
	}

	return {
		get phase() {
			return read<TeacherFlowPhase>('phase');
		},
		get workspaceId() {
			return read<TeacherFlowWorkspaceId>('workspaceId');
		},
		get snapshot() {
			return read<WorkspaceSnapshot>('snapshot');
		},
		get draft() {
			return read<ObservationFlowDraft | undefined>('draft');
		},
		get status() {
			return read<TeacherFlowStatus | undefined>('status');
		},
		get lastExportedAt() {
			return read<string | undefined>('lastExportedAt');
		},
		get today() {
			return selectToday(read<WorkspaceSnapshot>('snapshot'), options.clock());
		},
		memory(filters) {
			return selectMemory(read<WorkspaceSnapshot>('snapshot'), filters);
		},
		hydrate() {
			return activate(DEMO_WORKSPACE_ID);
		},
		switchWorkspace(nextWorkspaceId) {
			assertWorkspaceId(nextWorkspaceId);
			return activate(nextWorkspaceId);
		},
		async saveCourse(nextDraft, current) {
			await enqueueMutation(undefined, (context) =>
				context.repository.putCourse(
					current
						? updateCourse(
								current,
								{ ...nextDraft, workspaceId: context.workspaceId },
								options.clock
							)
						: createCourse({ ...nextDraft, workspaceId: context.workspaceId }, options.clock)
				)
			);
		},
		async archiveCourse(course) {
			await enqueueMutation(undefined, (context) => {
				if (course.workspaceId !== context.workspaceId) {
					throw new DomainError(
						'workspace_mismatch',
						'Course belongs to another workspace',
						'workspaceId'
					);
				}
				return context.repository.putCourse(archiveCourse(course, options.clock));
			});
		},
		async saveSession(nextDraft, current) {
			await enqueueMutation(undefined, (context) =>
				context.repository.putSession(
					current
						? updateSession(
								current,
								{ ...nextDraft, workspaceId: context.workspaceId },
								options.clock
							)
						: createSession({ ...nextDraft, workspaceId: context.workspaceId }, options.clock)
				)
			);
		},
		async saveObservationFlow(nextDraft) {
			await enqueueMutation(nextDraft, (context) => {
				const observation = createObservation(
					{ ...nextDraft.observation, workspaceId: context.workspaceId },
					options.clock
				);
				const decision = nextDraft.decision
					? createDecision(
							{
								...nextDraft.decision,
								workspaceId: context.workspaceId,
								observationId: observation.id
							},
							options.clock
						)
					: undefined;
				return context.repository.putObservationWithDecision(observation, decision);
			});
		},
		async editObservationWithDecision(nextDraft, current, decision, decisionText) {
			return enqueueMutation(undefined, async (context) => {
				if (
					current.workspaceId !== context.workspaceId ||
					(decision !== undefined && decision.workspaceId !== context.workspaceId)
				) {
					throw new DomainError(
						'workspace_mismatch',
						'Entity belongs to another workspace',
						'workspaceId'
					);
				}
				await context.repository.editObservationWithDecision({
					observationId: current.id,
					expectedObservationUpdatedAt: current.updatedAt,
					observation: { ...nextDraft, workspaceId: context.workspaceId },
					...(decision
						? {
								decision: {
									id: decision.id,
									expectedUpdatedAt: decision.updatedAt,
									text: decisionText ?? decision.text
								}
							}
						: {}),
					now: options.clock
				});
			});
		},
		async saveDecision(nextDraft) {
			await enqueueMutation(undefined, (context) =>
				context.repository.putDecision(
					createDecision({ ...nextDraft, workspaceId: context.workspaceId }, options.clock)
				)
			);
		},
		async advanceDecision(decision) {
			return enqueueMutation(undefined, async (context) => {
				if (decision.workspaceId !== context.workspaceId) {
					throw new DomainError(
						'workspace_mismatch',
						'Decision belongs to another workspace',
						'workspaceId'
					);
				}
				const next = decision.status === 'to_prepare' ? 'ready' : 'applied';
				await context.repository.advanceDecision({
					decisionId: decision.id,
					expectedUpdatedAt: decision.updatedAt,
					nextStatus: next,
					now: options.clock
				});
			});
		},
		async deleteObservation(observationId) {
			await enqueueMutation(undefined, (context) =>
				context.repository.deleteObservation(observationId)
			);
		},
		async deleteSession(sessionId) {
			await enqueueMutation(undefined, (context) => context.repository.deleteSession(sessionId));
		},
		async deleteCourse(courseId) {
			await enqueueMutation(undefined, (context) => context.repository.deleteCourse(courseId));
		},
		async resetDemo() {
			if (read<TeacherFlowWorkspaceId>('workspaceId') !== DEMO_WORKSPACE_ID) return;
			await enqueueMutation(undefined, (context) =>
				context.repository.replaceWorkspace(createDemoSeed(options.clock))
			);
		},
		async resetPersonal() {
			if (read<TeacherFlowWorkspaceId>('workspaceId') !== PERSONAL_WORKSPACE_ID) return;
			await enqueueMutation(undefined, (context) => context.repository.clearWorkspace());
		},
		async replacePersonal(nextSnapshot) {
			if (read<TeacherFlowWorkspaceId>('workspaceId') !== PERSONAL_WORKSPACE_ID) return false;
			return enqueueMutation(undefined, (context) =>
				context.repository.importPersonalWorkspace(nextSnapshot, TEACHERFLOW_APP_VERSION)
			);
		},
		async markPersonalExportedAt(exportedAt) {
			if (read<TeacherFlowWorkspaceId>('workspaceId') !== PERSONAL_WORKSPACE_ID) return false;
			const saved = await enqueueMutation(undefined, (context) =>
				context.repository.markPersonalExportedAt(exportedAt)
			);
			if (saved) write('lastExportedAt', exportedAt);
			return saved;
		}
	};
}
