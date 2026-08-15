import { SvelteMap } from 'svelte/reactivity';
import { TeacherFlowStorageError } from '../data/errors';
import type { TeacherFlowRepository } from '../data/repository';
import { createDemoSeed, DEMO_WORKSPACE_ID, PERSONAL_WORKSPACE_ID } from '../demo/seed';
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
	MemoryFilters,
	ObservationDraft,
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
	readonly today: ReturnType<typeof selectToday>;
	memory(filters: MemoryFilters): ReturnType<typeof selectMemory>;
	hydrate(): Promise<void>;
	switchWorkspace(workspaceId: TeacherFlowWorkspaceId): Promise<void>;
	saveCourse(draft: CourseDraft, current?: Course): Promise<void>;
	archiveCourse(course: Course): Promise<void>;
	saveSession(draft: SessionDraft, current?: Session): Promise<void>;
	saveObservationFlow(draft: ObservationFlowDraft): Promise<void>;
	saveDecision(draft: DecisionDraft): Promise<void>;
	deleteObservation(observationId: string): Promise<void>;
	resetDemo(): Promise<void>;
	resetPersonal(): Promise<void>;
}

type MutationContext = {
	readonly workspaceEpoch: number;
	readonly workspaceId: TeacherFlowWorkspaceId;
	readonly repository: TeacherFlowRepository;
	readonly mutationEpoch: number;
};

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
		['snapshot', emptySnapshot(DEMO_WORKSPACE_ID)]
	]);
	let repository: TeacherFlowRepository | undefined;
	let workspaceEpoch = 0;
	let mutationEpoch = 0;
	let mutationQueue = Promise.resolve();

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

	function mutationIsCurrent(context: MutationContext): boolean {
		return (
			workspaceEpoch === context.workspaceEpoch &&
			read<TeacherFlowWorkspaceId>('workspaceId') === context.workspaceId &&
			repository === context.repository &&
			mutationEpoch === context.mutationEpoch
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
	): Promise<void> {
		const draftToRetain =
			retainedDraft && isDraftFromActiveWorkspace(retainedDraft) ? retainedDraft : undefined;
		if (draftToRetain) write('draft', draftToRetain);
		const context = captureMutation();
		if (!context) {
			if (retainedDraft && !draftToRetain) return Promise.resolve();
			write('status', {
				kind: 'error',
				message: 'Le stockage local est encore en cours de préparation. Réessayez dans un instant.'
			} satisfies TeacherFlowStatus);
			return Promise.resolve();
		}
		write('status', undefined);
		const run = mutationQueue.then(async () => {
			let committed = false;
			try {
				await action(context);
				committed = true;
				if (!mutationIsCurrent(context)) return;
				const nextSnapshot = await context.repository.load();
				if (!mutationIsCurrent(context)) return;
				write('snapshot', nextSnapshot);
				write('draft', undefined);
				write('status', {
					kind: 'success',
					message: 'Enregistré localement'
				} satisfies TeacherFlowStatus);
				write('phase', isOnline() ? 'ready' : 'degraded');
			} catch (error) {
				if (!mutationIsCurrent(context)) return;
				if (committed) write('phase', 'error' satisfies TeacherFlowPhase);
				if (draftToRetain) write('draft', draftToRetain);
				write('status', {
					kind: 'error',
					message: recoveryMessage(error)
				} satisfies TeacherFlowStatus);
			}
		});
		mutationQueue = run.catch(() => undefined);
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
			const nextSnapshot = await nextRepository.load();
			if (!activationIsCurrent(epoch, nextWorkspaceId)) return;
			repository = nextRepository;
			write('snapshot', nextSnapshot);
			write('phase', isOnline() ? 'ready' : 'degraded');
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
		async saveDecision(nextDraft) {
			await enqueueMutation(undefined, (context) =>
				context.repository.putDecision(
					createDecision({ ...nextDraft, workspaceId: context.workspaceId }, options.clock)
				)
			);
		},
		async deleteObservation(observationId) {
			await enqueueMutation(undefined, (context) =>
				context.repository.deleteObservation(observationId)
			);
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
		}
	};
}
