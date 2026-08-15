import { SvelteMap } from 'svelte/reactivity';
import { createDecision, createObservation } from '../domain/commands';
import { selectMemory, selectToday } from '../domain/selectors';
import type {
	Clock,
	DecisionDraft,
	MemoryFilters,
	ObservationDraft,
	WorkspaceId,
	WorkspaceSnapshot
} from '../domain/types';
import type { TeacherFlowRepository } from '../data/repository';
import { TeacherFlowStorageError } from '../data/errors';
import { createDemoSeed, DEMO_WORKSPACE_ID, PERSONAL_WORKSPACE_ID } from '../demo/seed';

export type TeacherFlowPhase = 'loading' | 'ready' | 'degraded' | 'error';
export type TeacherFlowStatus = { readonly kind: 'success' | 'error'; readonly message: string };

export interface ObservationFlowDraft {
	readonly observation: ObservationDraft;
	readonly decision?: Omit<DecisionDraft, 'workspaceId' | 'observationId'>;
}

export interface TeacherFlowStateOptions {
	readonly repositoryFactory: (workspaceId: WorkspaceId) => Promise<TeacherFlowRepository>;
	readonly clock: Clock;
	/** False means the app remains usable locally but reports a degraded network condition. */
	readonly network?: () => boolean;
}

export interface TeacherFlowState {
	readonly phase: TeacherFlowPhase;
	readonly workspaceId: WorkspaceId;
	readonly snapshot: WorkspaceSnapshot;
	readonly draft?: ObservationFlowDraft;
	readonly status?: TeacherFlowStatus;
	readonly today: ReturnType<typeof selectToday>;
	memory(filters: MemoryFilters): ReturnType<typeof selectMemory>;
	hydrate(): Promise<void>;
	switchWorkspace(workspaceId: WorkspaceId): Promise<void>;
	saveObservationFlow(draft: ObservationFlowDraft): Promise<void>;
	saveDecision(draft: DecisionDraft): Promise<void>;
	deleteObservation(observationId: string): Promise<void>;
	resetDemo(): Promise<void>;
	resetPersonal(): Promise<void>;
}

function emptySnapshot(workspaceId: WorkspaceId): WorkspaceSnapshot {
	return { workspaceId, courses: [], sessions: [], observations: [], decisions: [] };
}

function recoveryMessage(error: unknown): string {
	if (error instanceof TeacherFlowStorageError) return error.recoveryInstruction;
	return 'La modification n’a pas été enregistrée localement. Réessayez.';
}

export function createTeacherFlowState(options: TeacherFlowStateOptions): TeacherFlowState {
	const values = new SvelteMap<string, unknown>([
		['phase', 'loading' satisfies TeacherFlowPhase],
		['workspaceId', DEMO_WORKSPACE_ID],
		['snapshot', emptySnapshot(DEMO_WORKSPACE_ID)]
	]);
	let repository: TeacherFlowRepository | undefined;
	let operation = 0;

	const read = <Value>(key: string): Value => values.get(key) as Value;
	const write = <Value>(key: string, value: Value): void => {
		values.set(key, value);
	};

	function isOnline(): boolean {
		return options.network?.() ?? true;
	}

	async function activate(nextWorkspaceId: WorkspaceId): Promise<void> {
		const currentOperation = ++operation;
		write('workspaceId', nextWorkspaceId);
		write('snapshot', emptySnapshot(nextWorkspaceId));
		write('draft', undefined);
		write('status', undefined);
		write('phase', 'loading' satisfies TeacherFlowPhase);
		repository = undefined;
		try {
			const nextRepository = await options.repositoryFactory(nextWorkspaceId);
			const nextSnapshot = await nextRepository.load();
			if (currentOperation !== operation) return;
			repository = nextRepository;
			write('snapshot', nextSnapshot);
			write('phase', isOnline() ? 'ready' : 'degraded');
		} catch (error) {
			if (currentOperation !== operation) return;
			write('phase', 'error' satisfies TeacherFlowPhase);
			write('status', {
				kind: 'error',
				message: recoveryMessage(error)
			} satisfies TeacherFlowStatus);
		}
	}

	function activeRepository(): TeacherFlowRepository {
		if (!repository) throw new Error('TeacherFlow is not ready');
		return repository;
	}

	async function refreshAfterCommit(successMessage = 'Enregistré localement'): Promise<void> {
		write('snapshot', await activeRepository().load());
		write('draft', undefined);
		write('status', { kind: 'success', message: successMessage } satisfies TeacherFlowStatus);
		write('phase', isOnline() ? 'ready' : 'degraded');
	}

	async function persist(
		action: () => Promise<void>,
		retainedDraft?: ObservationFlowDraft
	): Promise<void> {
		try {
			await action();
			await refreshAfterCommit();
		} catch (error) {
			if (retainedDraft) write('draft', retainedDraft);
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
			return read<WorkspaceId>('workspaceId');
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
			return activate(nextWorkspaceId);
		},
		async saveObservationFlow(nextDraft) {
			write('draft', nextDraft);
			await persist(() => {
				const observation = createObservation(
					{ ...nextDraft.observation, workspaceId: read<WorkspaceId>('workspaceId') },
					options.clock
				);
				const decision = nextDraft.decision
					? createDecision(
							{
								...nextDraft.decision,
								workspaceId: read<WorkspaceId>('workspaceId'),
								observationId: observation.id
							},
							options.clock
						)
					: undefined;
				return activeRepository().putObservationWithDecision(observation, decision);
			}, nextDraft);
		},
		async saveDecision(nextDraft) {
			await persist(() =>
				activeRepository().putDecision(
					createDecision(
						{ ...nextDraft, workspaceId: read<WorkspaceId>('workspaceId') },
						options.clock
					)
				)
			);
		},
		async deleteObservation(observationId) {
			await persist(() => activeRepository().deleteObservation(observationId));
		},
		async resetDemo() {
			if (read<WorkspaceId>('workspaceId') !== DEMO_WORKSPACE_ID) return;
			await persist(() => activeRepository().replaceWorkspace(createDemoSeed(options.clock)));
		},
		async resetPersonal() {
			if (read<WorkspaceId>('workspaceId') !== PERSONAL_WORKSPACE_ID) return;
			await persist(() => activeRepository().clearWorkspace());
		}
	};
}
