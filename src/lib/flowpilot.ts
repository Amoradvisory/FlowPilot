import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import type { Session } from '@supabase/supabase-js';
import { derived, get, writable } from 'svelte/store';
import {
	DEFAULT_SETTINGS,
	DEMO_USER_ID,
	REVIEW_DAY_VALUES,
	SOFT_DELETE_TABLES,
	SYNC_TABLES,
	TABLE_USER_FIELD
} from '$lib/constants';
import { db } from '$lib/db';
import { parseInboxText } from '$lib/parser';
import { isSupabaseConfigured, supabase } from '$lib/supabase';
import type {
	AuthState,
	ClarifiedTaskDraft,
	ConflictLog,
	FocusRuntime,
	FocusSession,
	Habit,
	HabitCompletion,
	InboxItem,
	LocalNotification,
	Note,
	Profile,
	Project,
	Review,
	SessionIdentity,
	ShellState,
	SyncOperation,
	SyncPayload,
	SyncQueueRecord,
	SyncState,
	TableName,
	Task,
	Subtask
} from '$lib/types';
import {
	addDaysIso,
	combineDateAndTime,
	computeHabitProgress,
	computeProjectProgress,
	deepEqual,
	formatMinutes,
	nowIso,
	pickNowTask,
	sortTasks,
	startOfWeekDate,
	todayDate,
	unique
} from '$lib/utils';

type AnyRecord = Record<string, unknown> & {
	id?: string;
	user_id?: string;
	version?: number;
	created_at?: string;
	updated_at?: string;
};

const clock = writable(new Date());

export const authState = writable<AuthState>({
	ready: false,
	mode: isSupabaseConfigured ? 'supabase' : 'local',
	configured: isSupabaseConfigured,
	user: null,
	message: isSupabaseConfigured ? 'Connectez-vous pour synchroniser vos donnees.' : 'Mode local actif.'
});

export const syncState = writable<SyncState>({
	running: false,
	pending: 0,
	lastSyncedAt: null,
	lastError: null,
	mode: isSupabaseConfigured ? 'online-sync' : 'local-only'
});

export const shellState = writable<ShellState>({
	secondaryMenuOpen: false,
	quickCaptureOpen: false,
	quickCaptureText: ''
});

export const currentUserId = writable<string | null>(isSupabaseConfigured ? null : DEMO_USER_ID);
export const online = writable<boolean>(browser ? navigator.onLine : true);

export const profile = writable<Profile | null>(null);
export const inboxItems = writable<InboxItem[]>([]);
export const projects = writable<Project[]>([]);
export const tasks = writable<Task[]>([]);
export const subtasks = writable<Subtask[]>([]);
export const notes = writable<Note[]>([]);
export const habits = writable<Habit[]>([]);
export const habitCompletions = writable<HabitCompletion[]>([]);
export const focusSessions = writable<FocusSession[]>([]);
export const reviews = writable<Review[]>([]);
export const conflictLogs = writable<ConflictLog[]>([]);
export const notificationCenter = writable<LocalNotification[]>([]);
export const focusRuntime = writable<FocusRuntime>({
	sessionId: null,
	taskId: null,
	startedAt: null,
	pauseStartedAt: null,
	pausedSeconds: 0,
	plannedMinutes: DEFAULT_SETTINGS.pomodoro_minutes,
	mode: 'idle'
});

export const pendingInboxItems = derived(inboxItems, ($inboxItems) =>
	$inboxItems
		.filter((item) => item.status === 'pending')
		.sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
);

export const activeProjects = derived(projects, ($projects) =>
	$projects.filter((project) => !project.deleted_at).sort((left, right) => left.position - right.position)
);

export const visibleTasks = derived(tasks, ($tasks) => $tasks.filter((task) => !task.deleted_at));

export const todayTasks = derived(visibleTasks, ($tasks) =>
	sortTasks($tasks.filter((task) => task.status !== 'done' && task.scheduled_date === todayDate()))
);

export const weekTasks = derived(visibleTasks, ($tasks) => {
	const start = startOfWeekDate();
	const startValue = start.toISOString().slice(0, 10);
	const end = new Date(start);
	end.setDate(end.getDate() + 6);
	const endValue = end.toISOString().slice(0, 10);

	return sortTasks(
		$tasks.filter((task) => {
			if (task.status === 'done') return false;
			if (!task.scheduled_date) return false;
			return task.scheduled_date >= startValue && task.scheduled_date <= endValue;
		})
	);
});

export const overdueTasks = derived(visibleTasks, ($tasks) =>
	sortTasks(
		$tasks.filter((task) => {
			if (task.status === 'done' || task.status === 'cancelled') return false;
			const compare =
				combineDateAndTime(task.scheduled_date, task.scheduled_time_end || task.scheduled_time_start) ||
				task.deadline;
			return compare ? new Date(compare).getTime() < Date.now() : false;
		})
	)
);

export const currentTask = derived([todayTasks, visibleTasks], ([$todayTasks, $visibleTasks]) =>
	pickNowTask($todayTasks.length ? $todayTasks : $visibleTasks.filter((task) => task.status !== 'done'))
);

export const projectProgress = derived([activeProjects, visibleTasks], ([$projects, $tasks]) =>
	computeProjectProgress($projects, $tasks)
);

export const habitProgress = derived([habits, habitCompletions], ([$habits, $habitCompletions]) =>
	computeHabitProgress($habits, $habitCompletions)
);

export const todayFocusMinutes = derived(focusSessions, ($focusSessions) => {
	const today = todayDate();

	return $focusSessions
		.filter((session) => session.started_at.slice(0, 10) === today)
		.reduce((total, session) => total + (session.duration_minutes ?? 0), 0);
});

export const dashboardPrompts = derived(
	[todayTasks, todayFocusMinutes, pendingInboxItems, overdueTasks, profile, clock],
	([$todayTasks, $todayFocusMinutes, $pendingInboxItems, $overdueTasks, $profile, $clock]) => {
		const items = [];
		const hour = $clock.getHours();

		if ($todayTasks.length === 0) {
			items.push({
				id: 'plan-day',
				title: 'Aucune tache planifiee',
				body: 'Planifie au moins une tache pour donner un cap clair a ta journee.',
				actionHref: '/tasks',
				actionLabel: 'Planifier',
				tone: 'warning' as const
			});
		}

		if ($todayFocusMinutes === 0 && hour >= 11 && hour < 19) {
			items.push({
				id: 'focus-reminder',
				title: 'Toujours aucun focus aujourd hui',
				body: 'Lance une session courte pour enclencher la machine.',
				actionHref: '/focus',
				actionLabel: 'Lancer focus',
				tone: 'info' as const
			});
		}

		if (hour >= 19) {
			items.push({
				id: 'review-mode',
				title: 'Mode revue rapide',
				body: 'Il est temps de vider les restes et preparer demain.',
				actionHref: '/review',
				actionLabel: 'Ouvrir revue',
				tone: 'info' as const
			});
		}

		if ($pendingInboxItems.length > 10) {
			items.push({
				id: 'inbox-backlog',
				title: 'Inbox surchargee',
				body: `${$pendingInboxItems.length} elements attendent une clarification.`,
				actionHref: '/clarify',
				actionLabel: 'Clarifier',
				tone: 'warning' as const
			});
		}

		if ($overdueTasks.length > 0) {
			items.push({
				id: 'overdue',
				title: 'Retards a traiter',
				body: `${$overdueTasks.length} element(s) depassent leur echeance.`,
				actionHref: '/tasks',
				actionLabel: 'Voir retards',
				tone: 'warning' as const
			});
		}

		if ($profile && $todayFocusMinutes >= $profile.settings.daily_focus_goal_minutes) {
			items.push({
				id: 'goal-hit',
				title: 'Objectif focus atteint',
				body: `Tu as deja cumule ${formatMinutes($todayFocusMinutes)} aujourd hui.`,
				actionHref: '/analytics',
				actionLabel: 'Voir stats',
				tone: 'info' as const
			});
		}

		return items;
	}
);

const emptyCollections = () => {
	profile.set(null);
	inboxItems.set([]);
	projects.set([]);
	tasks.set([]);
	subtasks.set([]);
	notes.set([]);
	habits.set([]);
	habitCompletions.set([]);
	focusSessions.set([]);
	reviews.set([]);
	conflictLogs.set([]);
	notificationCenter.set([]);
};

const createDefaultProfile = (user: SessionIdentity | null): Profile => {
	const timestamp = nowIso();
	return {
		id: user?.id ?? DEMO_USER_ID,
		display_name: user?.displayName ?? user?.email?.split('@')[0] ?? 'Pilot',
		settings: DEFAULT_SETTINGS,
		created_at: timestamp,
		updated_at: timestamp,
		version: 1
	};
};

const getRuntimeSeconds = (runtime: FocusRuntime) => {
	if (!runtime.startedAt) return 0;
	const started = new Date(runtime.startedAt).getTime();
	const now =
		runtime.mode === 'paused' && runtime.pauseStartedAt
			? new Date(runtime.pauseStartedAt).getTime()
			: Date.now();
	return Math.max(0, Math.floor((now - started - runtime.pausedSeconds * 1000) / 1000));
};

class FlowPilotController {
	private initialized = false;
	private authSubscription: { unsubscribe: () => void } | null = null;
	private realtimeChannel: { unsubscribe: () => Promise<'ok' | 'timed out' | 'error'> } | null = null;
	private clockInterval: number | null = null;
	private focusInterval: number | null = null;
	private syncTimer: number | null = null;
	private pullTimer: number | null = null;
	private syncInFlight = false;

	async init() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		await db.open();
		if ('serviceWorker' in navigator) {
			void navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
		}
		this.restoreFocusRuntime();
		this.startTickers();
		window.addEventListener('online', this.handleNetworkChange);
		window.addEventListener('offline', this.handleNetworkChange);

		if (supabase) {
			const { data } = await supabase.auth.getSession();
			await this.applySession(data.session);

			const listener = supabase.auth.onAuthStateChange((_event, session) => {
				void this.applySession(session);
			});
			this.authSubscription = listener.data.subscription;
		} else {
			const demoUser: SessionIdentity = {
				id: DEMO_USER_ID,
				email: null,
				displayName: 'Local mode',
				avatarUrl: null,
				provider: 'email'
			};
			authState.set({
				ready: true,
				mode: 'local',
				configured: false,
				user: demoUser,
				message: 'Mode local actif. Ajoutez vos cles Supabase pour activer la sync.'
			});
			await this.useUserContext(demoUser);
		}
	}

	destroy() {
		if (!browser) return;
		window.removeEventListener('online', this.handleNetworkChange);
		window.removeEventListener('offline', this.handleNetworkChange);
		if (this.clockInterval) window.clearInterval(this.clockInterval);
		if (this.focusInterval) window.clearInterval(this.focusInterval);
		if (this.syncTimer) window.clearTimeout(this.syncTimer);
		if (this.pullTimer) window.clearTimeout(this.pullTimer);
		if (this.authSubscription) this.authSubscription.unsubscribe();
		void this.stopRealtime();
	}

	private handleNetworkChange = () => {
		const status = navigator.onLine;
		online.set(status);
		syncState.update((state) => ({
			...state,
			mode: status && supabase ? 'online-sync' : 'local-only'
		}));

		if (status) {
			this.schedulePull('network-restored');
			this.scheduleSync('network-restored');
		}
	};

	private startTickers() {
		this.clockInterval = window.setInterval(() => {
			clock.set(new Date());
			if (this.canSync()) {
				this.schedulePull('heartbeat');
				this.scheduleSync('heartbeat');
			}
		}, 30_000);

		this.focusInterval = window.setInterval(() => {
			const runtime = get(focusRuntime);
			if (runtime.mode !== 'running') return;
			this.persistFocusRuntime(runtime);
			const elapsed = getRuntimeSeconds(runtime);

			if (elapsed >= runtime.plannedMinutes * 60) {
				const next = { ...runtime, mode: 'prompt' as const };
				focusRuntime.set(next);
				this.persistFocusRuntime(next);
				void this.notify('focus_done', 'Pomodoro termine', 'Ta session est terminee.');
			}
		}, 1_000);
	}

	private persistFocusRuntime(runtime: FocusRuntime) {
		if (!browser) return;
		localStorage.setItem('flowpilot-focus-runtime', JSON.stringify(runtime));
	}

	private restoreFocusRuntime() {
		if (!browser) return;
		const stored = localStorage.getItem('flowpilot-focus-runtime');
		if (!stored) return;
		try {
			focusRuntime.set(JSON.parse(stored) as FocusRuntime);
		} catch {
			localStorage.removeItem('flowpilot-focus-runtime');
		}
	}

	private async applySession(session: Session | null) {
		if (!supabase) return;

		if (!session?.user) {
			authState.set({
				ready: true,
				mode: 'supabase',
				configured: true,
				user: null,
				message: 'Connectez-vous pour retrouver vos donnees sur tous vos appareils.'
			});
			currentUserId.set(null);
			emptyCollections();
			await this.stopRealtime();
			return;
		}

		const user: SessionIdentity = {
			id: session.user.id,
			email: session.user.email ?? null,
			displayName:
				typeof session.user.user_metadata?.full_name === 'string'
					? session.user.user_metadata.full_name
					: typeof session.user.user_metadata?.name === 'string'
						? session.user.user_metadata.name
						: null,
			avatarUrl:
				typeof session.user.user_metadata?.avatar_url === 'string'
					? session.user.user_metadata.avatar_url
					: typeof session.user.user_metadata?.picture === 'string'
						? session.user.user_metadata.picture
						: null,
			provider:
				typeof session.user.app_metadata?.provider === 'string'
					? session.user.app_metadata.provider
					: null
		};

		authState.set({
			ready: true,
			mode: 'supabase',
			configured: true,
			user,
			message: null
		});

		await this.useUserContext(user);
	}

	private async useUserContext(user: SessionIdentity | null) {
		if (!user) {
			currentUserId.set(null);
			emptyCollections();
			return;
		}

		currentUserId.set(user.id);
		if (!supabase) {
			await db.sync_queue.where('user_id').equals(user.id).delete();
		}
		await this.ensureProfile(user);
		await this.refreshAll();
		await this.startRealtime(user.id);
		this.schedulePull('session-ready');
		this.scheduleSync('session-ready');
	}

	private async ensureProfile(user: SessionIdentity) {
		const localProfile = await db.profiles.get(user.id);
		if (localProfile) {
			profile.set(localProfile);
			return;
		}

		const created = createDefaultProfile(user);
		await db.profiles.put(created);
		await this.enqueueChange('profiles', 'insert', user.id, {
			data: created as unknown as Record<string, unknown>,
			expectedVersion: 0,
			baseSnapshot: null
		});
		profile.set(created);
	}

	private getTable(tableName: TableName) {
		return db.table(tableName);
	}

	private async refreshAll() {
		const userId = get(currentUserId);

		if (!userId) {
			emptyCollections();
			return;
		}

		const [
			profileRow,
			inboxRows,
			projectRows,
			taskRows,
			subtaskRows,
			noteRows,
			habitRows,
			completionRows,
			focusRows,
			reviewRows,
			queueRows,
			conflictRows,
			notificationRows
		] = await Promise.all([
			db.profiles.get(userId),
			db.inbox_items.where('user_id').equals(userId).sortBy('created_at'),
			db.projects.where('user_id').equals(userId).sortBy('position'),
			db.tasks.where('user_id').equals(userId).sortBy('created_at'),
			db.subtasks.where('user_id').equals(userId).sortBy('position'),
			db.notes.where('user_id').equals(userId).sortBy('created_at'),
			db.habits.where('user_id').equals(userId).sortBy('position'),
			db.habit_completions.where('user_id').equals(userId).sortBy('completed_date'),
			db.focus_sessions.where('user_id').equals(userId).sortBy('started_at'),
			db.reviews.where('user_id').equals(userId).sortBy('week_start'),
			db.sync_queue.where('user_id').equals(userId).toArray(),
			db.local_conflicts.where('user_id').equals(userId).sortBy('created_at'),
			db.local_notifications.where('user_id').equals(userId).sortBy('created_at')
		]);

		profile.set(profileRow ?? createDefaultProfile(get(authState).user));
		inboxItems.set([...inboxRows]);
		projects.set([...projectRows]);
		tasks.set([...taskRows]);
		subtasks.set([...subtaskRows]);
		notes.set([...noteRows]);
		habits.set([...habitRows]);
		habitCompletions.set([...completionRows]);
		focusSessions.set([...focusRows].reverse());
		reviews.set([...reviewRows].reverse());
		conflictLogs.set([...conflictRows].reverse());
		notificationCenter.set([...notificationRows].reverse());

		syncState.update((state) => ({
			...state,
			pending: queueRows.filter((item) => item.status !== 'done').length
		}));

		await this.evaluateNotifications();
	}

	private async refreshNotificationsOnly() {
		const userId = get(currentUserId);
		if (!userId) return;
		const notificationRows = await db.local_notifications.where('user_id').equals(userId).sortBy('created_at');
		notificationCenter.set([...notificationRows].reverse());
	}

	private async enqueueChange(
		tableName: TableName,
		operation: SyncOperation,
		recordId: string,
		payload: SyncPayload
	) {
		if (!supabase) return;
		const userId = get(currentUserId);
		if (!userId) return;

		const existing = (
			await db.sync_queue.where('[table_name+record_id]').equals([tableName, recordId]).toArray()
		).find((item) => item.status === 'pending' || item.status === 'failed' || item.status === 'processing');

		if (existing) {
			if (existing.operation === 'insert' && operation === 'delete') {
				await db.sync_queue.delete(existing.id);
				return;
			}

			const mergedOperation =
				existing.operation === 'insert' && operation === 'update'
					? 'insert'
					: operation === 'delete'
						? 'delete'
						: existing.operation;

			await db.sync_queue.put({
				...existing,
				operation: mergedOperation,
				payload: {
					...payload,
					baseSnapshot: existing.payload.baseSnapshot ?? payload.baseSnapshot ?? null,
					expectedVersion: existing.payload.expectedVersion ?? payload.expectedVersion
				},
				status: 'pending',
				updated_at: nowIso()
			});
			return;
		}

		await db.sync_queue.put({
			id: crypto.randomUUID(),
			user_id: userId,
			table_name: tableName,
			record_id: recordId,
			operation,
			payload,
			status: 'pending',
			retry_count: 0,
			created_at: nowIso(),
			updated_at: nowIso()
		});
	}

	private async saveEntity<T extends AnyRecord>(tableName: TableName, draft: T) {
		const userId = get(currentUserId);
		if (!userId) return null;

		const table = this.getTable(tableName);
		const incomingId = tableName === 'profiles' ? userId : (draft.id ?? crypto.randomUUID());
		const existing = (await table.get(incomingId)) as T | undefined;
		const timestamp = nowIso();
		const record = {
			...existing,
			...draft,
			id: incomingId,
			user_id: tableName === 'profiles' ? undefined : (draft.user_id ?? userId),
			version: typeof existing?.version === 'number' ? existing.version + 1 : 1,
			created_at: existing?.created_at ?? timestamp,
			updated_at: timestamp
		} as T;

		if (tableName === 'profiles') {
			delete (record as Record<string, unknown>).user_id;
		}

		await table.put(record);
		await this.enqueueChange(tableName, existing ? 'update' : 'insert', incomingId, {
			data: record as Record<string, unknown>,
			expectedVersion: Number(existing?.version ?? 0),
			baseSnapshot: (existing as Record<string, unknown> | undefined) ?? null
		});
		await this.refreshAll();
		this.scheduleSync(`${tableName}-save`);
		return record;
	}

	private async deleteEntity(tableName: TableName, id: string) {
		const table = this.getTable(tableName);
		const existing = (await table.get(id)) as AnyRecord | undefined;
		if (!existing) return;

		if (SOFT_DELETE_TABLES.has(tableName)) {
			await this.saveEntity(tableName, {
				...existing,
				deleted_at: nowIso()
			});
			return;
		}

		await table.delete(id);
		await this.enqueueChange(tableName, 'delete', id, {
			data: existing,
			expectedVersion: Number(existing.version ?? 0),
			baseSnapshot: existing
		});
		await this.refreshAll();
		this.scheduleSync(`${tableName}-delete`);
	}

	private canSync() {
		return Boolean(browser && supabase && navigator.onLine && get(currentUserId));
	}

	private scheduleSync(_reason: string) {
		if (!this.canSync()) return;
		if (this.syncTimer) window.clearTimeout(this.syncTimer);
		this.syncTimer = window.setTimeout(() => {
			void this.processQueue();
		}, 600);
	}

	private schedulePull(_reason: string) {
		if (!this.canSync()) return;
		if (this.pullTimer) window.clearTimeout(this.pullTimer);
		this.pullTimer = window.setTimeout(() => {
			void this.pullRemoteSnapshot();
		}, 500);
	}

	async syncNow() {
		await this.processQueue();
	}

	private async processQueue() {
		if (!this.canSync() || this.syncInFlight || !supabase) return;
		this.syncInFlight = true;
		syncState.update((state) => ({ ...state, running: true, lastError: null }));

		try {
			const userId = get(currentUserId);
			if (!userId) return;

			const queueItems = (await db.sync_queue.where('user_id').equals(userId).toArray())
				.filter((item) => item.status === 'pending' || item.status === 'failed')
				.sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

			for (const item of queueItems) {
				await db.sync_queue.update(item.id, { status: 'processing', updated_at: nowIso() });

				try {
					await this.pushQueueItem(item);
					await db.sync_queue.delete(item.id);
				} catch (error) {
					await db.sync_queue.update(item.id, {
						status: 'failed',
						retry_count: item.retry_count + 1,
						updated_at: nowIso()
					});

					if (error instanceof Error) {
						syncState.update((state) => ({ ...state, lastError: error.message }));
					}

					if (error instanceof Error && /network|auth|jwt|session/i.test(error.message)) {
						break;
					}
				}
			}

			await this.pullRemoteSnapshot();
			syncState.update((state) => ({
				...state,
				lastSyncedAt: nowIso(),
				mode: 'online-sync'
			}));
		} finally {
			this.syncInFlight = false;
			await this.refreshAll();
			syncState.update((state) => ({ ...state, running: false }));
		}
	}

	private async fetchRemoteSnapshot(tableName: TableName, userId: string) {
		if (!supabase) return [];
		let query = supabase.from(tableName).select('*');

		if (TABLE_USER_FIELD[tableName] === 'id') {
			query = query.eq('id', userId);
		} else {
			query = query.eq('user_id', userId);
		}

		const { data, error } = await query;
		if (error) throw error;
		return (data ?? []) as AnyRecord[];
	}

	private async fetchRemoteRecord(tableName: TableName, id: string) {
		if (!supabase) return null;
		const { data, error } = await supabase.from(tableName).select('*').eq('id', id).maybeSingle();
		if (error) throw error;
		return (data as AnyRecord | null) ?? null;
	}

	private async pushQueueItem(item: SyncQueueRecord) {
		if (!supabase) return;
		const table = supabase.from(item.table_name);
		const localRecord = item.payload.data as AnyRecord;
		const remoteRecord = await this.fetchRemoteRecord(item.table_name, item.record_id);

		if (item.operation === 'delete') {
			if (!remoteRecord) return;

			if (SOFT_DELETE_TABLES.has(item.table_name)) {
				const tombstone = {
					...remoteRecord,
					deleted_at: nowIso(),
					updated_at: nowIso(),
					version: Number(remoteRecord.version ?? 0) + 1
				};
				const { error } = await table.upsert(tombstone);
				if (error) throw error;
				await this.getTable(item.table_name).put(tombstone);
				return;
			}

			const { error } = await table.delete().eq('id', item.record_id);
			if (error) throw error;
			return;
		}

		const expectedVersion = Number(item.payload.expectedVersion ?? 0);
		let payload = localRecord;

		if (remoteRecord && Number(remoteRecord.version ?? 0) > expectedVersion) {
			payload = await this.mergeConflict(
				item.table_name,
				item.record_id,
				item.payload.baseSnapshot as AnyRecord | null,
				localRecord,
				remoteRecord
			);
		}

		const { error } = await table.upsert(payload);
		if (error) throw error;
		await this.getTable(item.table_name).put(payload);
	}

	private async mergeConflict(
		tableName: TableName,
		recordId: string,
		baseSnapshot: AnyRecord | null,
		localRecord: AnyRecord,
		remoteRecord: AnyRecord
	) {
		const merged: AnyRecord = {
			...remoteRecord,
			...localRecord
		};
		const trackedFields = unique(
			Object.keys({
				...baseSnapshot,
				...localRecord,
				...remoteRecord
			})
		).filter((field) => !['id', 'user_id', 'version', 'created_at', 'updated_at'].includes(field));
		const conflicts: string[] = [];

		for (const field of trackedFields) {
			const baseValue = baseSnapshot ? baseSnapshot[field] : undefined;
			const localValue = localRecord[field];
			const remoteValue = remoteRecord[field];
			const localChanged = !deepEqual(localValue, baseValue);
			const remoteChanged = !deepEqual(remoteValue, baseValue);

			if (localChanged && !remoteChanged) {
				merged[field] = localValue;
				continue;
			}

			if (!localChanged && remoteChanged) {
				merged[field] = remoteValue;
				continue;
			}

			if (localChanged && remoteChanged && !deepEqual(localValue, remoteValue)) {
				conflicts.push(field);
				const preferLocal =
					new Date(String(localRecord.updated_at ?? 0)).getTime() >=
					new Date(String(remoteRecord.updated_at ?? 0)).getTime();
				merged[field] = preferLocal ? localValue : remoteValue;
			}
		}

		merged.version = Math.max(Number(remoteRecord.version ?? 0), Number(localRecord.version ?? 0)) + 1;
		merged.updated_at = nowIso();
		merged.created_at = String(remoteRecord.created_at ?? localRecord.created_at ?? nowIso());

		if (conflicts.length) {
			await db.local_conflicts.put({
				id: crypto.randomUUID(),
				user_id: get(currentUserId) ?? DEMO_USER_ID,
				table_name: tableName,
				record_id: recordId,
				fields: conflicts,
				local_snapshot: localRecord,
				remote_snapshot: remoteRecord,
				resolved_snapshot: merged,
				created_at: nowIso()
			});
		}

		return merged;
	}

	private async pullRemoteSnapshot() {
		if (!this.canSync() || !supabase) return;
		const userId = get(currentUserId);
		if (!userId) return;

		for (const tableName of SYNC_TABLES) {
			const remoteRows = await this.fetchRemoteSnapshot(tableName, userId);
			const localTable = this.getTable(tableName);
			const pendingIds = new Set(
				(await db.sync_queue.where('table_name').equals(tableName).toArray())
					.filter((item) => item.status === 'pending' || item.status === 'processing')
					.map((item) => item.record_id)
			);

			if (tableName === 'profiles') {
				const remoteProfile = remoteRows.at(0);
				if (remoteProfile && !pendingIds.has(String(remoteProfile.id))) {
					await localTable.put(remoteProfile);
				}
				continue;
			}

			for (const row of remoteRows) {
				if (!pendingIds.has(String(row.id))) {
					await localTable.put(row);
				}
			}

			if (!SOFT_DELETE_TABLES.has(tableName)) {
				const localRows = (await localTable.where(TABLE_USER_FIELD[tableName]).equals(userId).toArray()) as AnyRecord[];
				const remoteIds = new Set(remoteRows.map((row) => String(row.id)));

				for (const row of localRows) {
					if (!pendingIds.has(String(row.id)) && !remoteIds.has(String(row.id))) {
						await localTable.delete(String(row.id));
					}
				}
			}
		}

		await this.refreshAll();
	}

	private async startRealtime(userId: string) {
		if (!supabase) return;
		await this.stopRealtime();

		const channel = supabase.channel(`flowpilot-${userId}`);

		for (const tableName of SYNC_TABLES) {
			channel.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: tableName,
					filter: `${TABLE_USER_FIELD[tableName]}=eq.${userId}`
				},
				() => this.schedulePull('realtime')
			);
		}

		await channel.subscribe();
		this.realtimeChannel = channel as unknown as { unsubscribe: () => Promise<'ok' | 'timed out' | 'error'> };
	}

	private async stopRealtime() {
		if (!this.realtimeChannel) return;
		await this.realtimeChannel.unsubscribe();
		this.realtimeChannel = null;
	}

	private async upsertNotification(kind: LocalNotification['kind'], title: string, body: string) {
		const userId = get(currentUserId);
		if (!userId) return;

		const existing = (
			await db.local_notifications.where('user_id').equals(userId).toArray()
		).find((item) => item.kind === kind && !item.dismissed);

		if (existing) return;

		await db.local_notifications.put({
			id: crypto.randomUUID(),
			user_id: userId,
			kind,
			title,
			body,
			dismissed: false,
			created_at: nowIso()
		});
	}

	private async clearNotification(kind: LocalNotification['kind']) {
		const userId = get(currentUserId);
		if (!userId) return;

		const activeItems = (await db.local_notifications.where('user_id').equals(userId).toArray()).filter(
			(item) => item.kind === kind && !item.dismissed
		);

		if (!activeItems.length) return;

		await db.local_notifications.bulkPut(
			activeItems.map((item) => ({
				...item,
				dismissed: true
			}))
		);
	}

	private async notify(kind: LocalNotification['kind'], title: string, body: string) {
		await this.upsertNotification(kind, title, body);

		if (!browser || !('Notification' in window)) return;
		if (Notification.permission === 'granted') {
			new Notification(title, { body, icon: '/icons/icon-192.png' });
		}
	}

	private async evaluateNotifications() {
		const pending = get(pendingInboxItems);
		const pendingOver24h = pending.filter(
			(item) => Date.now() - new Date(item.created_at).getTime() > 24 * 60 * 60 * 1000
		);

		if (pending.length > 10 && pendingOver24h.length > 0) {
			await this.upsertNotification(
				'inbox_backlog',
				'Inbox a clarifier',
				`${pending.length} elements attendent depuis trop longtemps.`
			);
		} else {
			await this.clearNotification('inbox_backlog');
		}

		const stagnantProjects = get(projectProgress).filter((item) => item.isStagnant);
		if (stagnantProjects.length > 0) {
			await this.upsertNotification(
				'stagnant_project',
				'Projet stagnant',
				`${stagnantProjects[0].project.title} n a pas bouge depuis plus de 7 jours.`
			);
		} else {
			await this.clearNotification('stagnant_project');
		}

		if (get(todayFocusMinutes) === 0 && new Date().getHours() >= 11 && new Date().getHours() < 19) {
			await this.upsertNotification(
				'focus_reminder',
				'Un premier focus ?',
				'Lance une session courte pour mettre la journee en mouvement.'
			);
		} else {
			await this.clearNotification('focus_reminder');
		}

		const reviewDay = get(profile)?.settings.review_day ?? DEFAULT_SETTINGS.review_day;
		const currentWeekStart = startOfWeekDate().toISOString().slice(0, 10);
		const hasReviewThisWeek = get(reviews).some((item) => item.week_start === currentWeekStart);
		const todayReviewDay = REVIEW_DAY_VALUES[new Date().getDay()];
		if (!hasReviewThisWeek && todayReviewDay === reviewDay && new Date().getHours() >= 19) {
			await this.upsertNotification(
				'weekly_review',
				'Revue hebdo',
				'Prends 10 minutes pour fermer la semaine et choisir 3 priorites.'
			);
		} else {
			await this.clearNotification('weekly_review');
		}

		await this.refreshNotificationsOnly();
	}

	openQuickCapture(text = '') {
		shellState.set({
			secondaryMenuOpen: false,
			quickCaptureOpen: true,
			quickCaptureText: text
		});
	}

	closeQuickCapture() {
		shellState.update((state) => ({ ...state, quickCaptureOpen: false, quickCaptureText: '' }));
	}

	toggleSecondaryMenu() {
		shellState.update((state) => ({ ...state, secondaryMenuOpen: !state.secondaryMenuOpen }));
	}

	closeSecondaryMenu() {
		shellState.update((state) => ({ ...state, secondaryMenuOpen: false }));
	}

	async saveProfileSettings(partial: Partial<Profile>) {
		const current = get(profile);
		if (!current) return;
		await this.saveEntity('profiles', {
			...current,
			...partial,
			settings: {
				...current.settings,
				...partial.settings
			}
		});
	}

	async createInboxItem(rawText: string) {
		const userId = get(currentUserId);
		if (!userId) return;
		const draft = parseInboxText(rawText, get(activeProjects));
		await this.saveEntity('inbox_items', {
			user_id: userId,
			...draft,
			status: 'pending'
		});
		this.closeQuickCapture();
	}

	async updateInboxItem(id: string, partial: Partial<InboxItem>) {
		const existing = get(inboxItems).find((item) => item.id === id);
		if (!existing) return;
		await this.saveEntity('inbox_items', {
			...existing,
			...partial
		});
	}

	async clarifyInboxToTask(id: string, draft: ClarifiedTaskDraft) {
		const item = get(inboxItems).find((entry) => entry.id === id);
		if (!item) return;

		await this.saveEntity('tasks', {
			user_id: item.user_id,
			title: draft.title || item.raw_text,
			description: draft.description ?? null,
			priority: draft.priority ?? item.parsed_priority ?? 'normal',
			estimated_duration: draft.estimated_duration ?? 25,
			energy: draft.energy ?? null,
			context: draft.context ?? null,
			project_id: draft.project_id ?? item.project_id ?? null,
			deadline: draft.deadline ?? item.parsed_date ?? null,
			scheduled_date: draft.scheduled_date ?? (item.parsed_date ? item.parsed_date.slice(0, 10) : null),
			scheduled_time_start: draft.scheduled_time_start ?? null,
			scheduled_time_end: draft.scheduled_time_end ?? null,
			status: 'todo',
			position: get(visibleTasks).length,
			total_focus_minutes: 0,
			deleted_at: null
		});

		await this.updateInboxItem(id, { status: 'clarified' });
	}

	async clarifyInboxToNote(id: string) {
		const item = get(inboxItems).find((entry) => entry.id === id);
		if (!item) return;

		await this.saveEntity('notes', {
			user_id: item.user_id,
			title: item.raw_text.slice(0, 60),
			content: item.raw_text,
			project_id: item.project_id,
			tags: item.parsed_tags,
			deleted_at: null
		});

		await this.updateInboxItem(id, { status: 'clarified' });
	}

	async clarifyInboxToProject(id: string) {
		const item = get(inboxItems).find((entry) => entry.id === id);
		if (!item) return;

		await this.saveEntity('projects', {
			user_id: item.user_id,
			title: item.raw_text.slice(0, 80),
			description: item.raw_text,
			status: 'active',
			deadline: item.parsed_date,
			position: get(activeProjects).length,
			deleted_at: null
		});

		await this.updateInboxItem(id, { status: 'clarified' });
	}

	async snoozeInboxItem(id: string) {
		await this.updateInboxItem(id, {
			parsed_date: addDaysIso(new Date(), 1)
		});
	}

	async deleteInboxItem(id: string) {
		await this.updateInboxItem(id, { status: 'deleted' });
	}

	async createTask(partial: Partial<Task> & Pick<Task, 'title'>) {
		const userId = get(currentUserId);
		if (!userId) return;

		await this.saveEntity('tasks', {
			user_id: userId,
			title: partial.title,
			description: partial.description ?? null,
			priority: partial.priority ?? 'normal',
			estimated_duration: partial.estimated_duration ?? 25,
			energy: partial.energy ?? null,
			context: partial.context ?? null,
			project_id: partial.project_id ?? null,
			deadline: partial.deadline ?? null,
			scheduled_date: partial.scheduled_date ?? null,
			scheduled_time_start: partial.scheduled_time_start ?? null,
			scheduled_time_end: partial.scheduled_time_end ?? null,
			status: partial.status ?? 'todo',
			position: get(visibleTasks).length,
			total_focus_minutes: partial.total_focus_minutes ?? 0,
			deleted_at: null
		});
	}

	async updateTask(id: string, partial: Partial<Task>) {
		const current = get(tasks).find((task) => task.id === id);
		if (!current) return;
		await this.saveEntity('tasks', {
			...current,
			...partial
		});
	}

	async completeTask(id: string) {
		await this.updateTask(id, { status: 'done' });
	}

	async postponeTask(id: string) {
		await this.updateTask(id, { scheduled_date: addDaysIso(new Date(), 1).slice(0, 10) });
	}

	async unscheduleTask(id: string) {
		await this.updateTask(id, {
			scheduled_date: null,
			scheduled_time_start: null,
			scheduled_time_end: null
		});
	}

	async createSubtask(taskId: string, title: string) {
		const task = get(tasks).find((item) => item.id === taskId);
		if (!task) return;

		await this.saveEntity('subtasks', {
			task_id: taskId,
			user_id: task.user_id,
			title,
			is_done: false,
			position: get(subtasks).filter((item) => item.task_id === taskId).length
		});
	}

	async toggleSubtask(id: string) {
		const current = get(subtasks).find((item) => item.id === id);
		if (!current) return;
		await this.saveEntity('subtasks', { ...current, is_done: !current.is_done });
	}

	async deleteSubtask(id: string) {
		await this.deleteEntity('subtasks', id);
	}

	async createProject(partial: Partial<Project> & Pick<Project, 'title'>) {
		const userId = get(currentUserId);
		if (!userId) return;
		await this.saveEntity('projects', {
			user_id: userId,
			title: partial.title,
			description: partial.description ?? null,
			status: partial.status ?? 'active',
			deadline: partial.deadline ?? null,
			position: get(activeProjects).length,
			deleted_at: null
		});
	}

	async updateProject(id: string, partial: Partial<Project>) {
		const current = get(projects).find((project) => project.id === id);
		if (!current) return;
		await this.saveEntity('projects', { ...current, ...partial });
	}

	async createNote(partial: Partial<Note> & Pick<Note, 'title'>) {
		const userId = get(currentUserId);
		if (!userId) return;
		await this.saveEntity('notes', {
			user_id: userId,
			title: partial.title,
			content: partial.content ?? null,
			project_id: partial.project_id ?? null,
			tags: partial.tags ?? [],
			deleted_at: null
		});
	}

	async updateNote(id: string, partial: Partial<Note>) {
		const current = get(notes).find((note) => note.id === id);
		if (!current) return;
		await this.saveEntity('notes', { ...current, ...partial });
	}

	async deleteNote(id: string) {
		await this.deleteEntity('notes', id);
	}

	async createHabit(
		title: string,
		frequency: Habit['frequency'] = 'daily',
		frequencyTarget?: number
	) {
		const userId = get(currentUserId);
		if (!userId) return;
		await this.saveEntity('habits', {
			user_id: userId,
			title,
			frequency,
			frequency_target:
				frequencyTarget ?? (frequency === 'daily' ? 7 : frequency === 'weekly_3' ? 3 : frequency === 'weekly_5' ? 5 : 4),
			current_streak: 0,
			best_streak: 0,
			position: get(habits).length,
			deleted_at: null
		});
	}

	async updateHabit(id: string, partial: Partial<Habit>) {
		const current = get(habits).find((habit) => habit.id === id);
		if (!current) return;
		await this.saveEntity('habits', { ...current, ...partial });
	}

	async deleteHabit(id: string) {
		await this.deleteEntity('habits', id);
	}

	async deleteProject(id: string) {
		await this.deleteEntity('projects', id);
	}

	private recalculateHabitStats(habitId: string) {
		const habit = get(habits).find((item) => item.id === habitId);
		if (!habit) return habit;
		const completions = get(habitCompletions)
			.filter((item) => item.habit_id === habitId)
			.map((item) => item.completed_date)
			.sort();
		let current = 0;
		let best = 0;
		let streak = 0;
		let previousDate: string | null = null;

		for (const date of completions) {
			const previous = previousDate ? new Date(`${previousDate}T00:00:00`).getTime() : null;
			const currentDate = new Date(`${date}T00:00:00`).getTime();

			if (previous === null || currentDate - previous === 24 * 60 * 60 * 1000) {
				streak += 1;
			} else {
				streak = 1;
			}

			best = Math.max(best, streak);
			previousDate = date;
		}

		let cursor = new Date();
		while (completions.includes(cursor.toISOString().slice(0, 10))) {
			current += 1;
			cursor.setDate(cursor.getDate() - 1);
		}

		return { ...habit, current_streak: current, best_streak: best };
	}

	async toggleHabitCompletion(habitId: string, completedDate = todayDate()) {
		const habit = get(habits).find((item) => item.id === habitId);
		if (!habit) return;
		const existing = get(habitCompletions).find(
			(item) => item.habit_id === habitId && item.completed_date === completedDate
		);

		if (existing) {
			await this.deleteEntity('habit_completions', existing.id);
		} else {
			await this.saveEntity('habit_completions', {
				user_id: habit.user_id,
				habit_id: habitId,
				completed_date: completedDate
			});
		}

		await this.refreshAll();
		const updatedHabit = this.recalculateHabitStats(habitId);
		if (updatedHabit) {
			await this.saveEntity('habits', updatedHabit);
		}
	}

	async startFocus(taskId: string, plannedMinutes?: number) {
		const task = get(tasks).find((item) => item.id === taskId);
		if (!task) return;
		const minutes = plannedMinutes ?? get(profile)?.settings.pomodoro_minutes ?? DEFAULT_SETTINGS.pomodoro_minutes;

		const session = (await this.saveEntity('focus_sessions', {
			user_id: task.user_id,
			task_id: task.id,
			started_at: nowIso(),
			ended_at: null,
			duration_minutes: null,
			completed: false
		})) as FocusSession | null;

		if (!session) return;

		const runtime: FocusRuntime = {
			sessionId: session.id,
			taskId: task.id,
			startedAt: session.started_at,
			pauseStartedAt: null,
			pausedSeconds: 0,
			plannedMinutes: minutes,
			mode: 'running'
		};

		focusRuntime.set(runtime);
		this.persistFocusRuntime(runtime);
		await this.updateTask(taskId, { status: 'in_progress' });
	}

	pauseFocus() {
		const runtime = get(focusRuntime);
		if (runtime.mode !== 'running') return;
		const next = {
			...runtime,
			mode: 'paused' as const,
			pauseStartedAt: nowIso()
		};
		focusRuntime.set(next);
		this.persistFocusRuntime(next);
	}

	resumeFocus() {
		const runtime = get(focusRuntime);
		if (runtime.mode !== 'paused' || !runtime.pauseStartedAt) return;
		const pausedFor = Math.floor((Date.now() - new Date(runtime.pauseStartedAt).getTime()) / 1000);
		const next = {
			...runtime,
			mode: 'running' as const,
			pauseStartedAt: null,
			pausedSeconds: runtime.pausedSeconds + pausedFor
		};
		focusRuntime.set(next);
		this.persistFocusRuntime(next);
	}

	async finishFocus(markTaskDone = false) {
		const runtime = get(focusRuntime);
		if (!runtime.sessionId || !runtime.taskId || !runtime.startedAt) return;

		const elapsedMinutes = Math.max(1, Math.round(getRuntimeSeconds(runtime) / 60));
		const session = get(focusSessions).find((item) => item.id === runtime.sessionId);

		if (session) {
			await this.saveEntity('focus_sessions', {
				...session,
				ended_at: nowIso(),
				duration_minutes: elapsedMinutes,
				completed: markTaskDone
			});
		}

		const task = get(tasks).find((item) => item.id === runtime.taskId);
		if (task) {
			await this.updateTask(task.id, {
				total_focus_minutes: task.total_focus_minutes + elapsedMinutes,
				status: markTaskDone ? 'done' : task.status === 'in_progress' ? 'todo' : task.status
			});
		}

		const next: FocusRuntime = {
			sessionId: null,
			taskId: null,
			startedAt: null,
			pauseStartedAt: null,
			pausedSeconds: 0,
			plannedMinutes: get(profile)?.settings.pomodoro_minutes ?? DEFAULT_SETTINGS.pomodoro_minutes,
			mode: 'idle'
		};
		focusRuntime.set(next);
		this.persistFocusRuntime(next);
	}

	getFocusSummary() {
		const runtime = get(focusRuntime);
		const elapsedSeconds = getRuntimeSeconds(runtime);
		return {
			elapsedSeconds,
			remainingSeconds: Math.max(0, runtime.plannedMinutes * 60 - elapsedSeconds),
			task: get(tasks).find((item) => item.id === runtime.taskId) ?? null
		};
	}

	async scheduleTask(taskId: string, date: string, startTime: string, durationMinutes: number) {
		const [hours, minutes] = startTime.split(':').map((item) => Number(item));
		const end = new Date(`${date}T00:00:00`);
		end.setHours(hours || 0, (minutes || 0) + durationMinutes, 0, 0);
		const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

		await this.updateTask(taskId, {
			scheduled_date: date,
			scheduled_time_start: startTime,
			scheduled_time_end: endTime
		});
	}

	async createWeeklyReview(notesText: string, priorities: string[]) {
		const userId = get(currentUserId);
		if (!userId) return;
		const weekStart = startOfWeekDate().toISOString().slice(0, 10);
		const weekDone = get(visibleTasks).filter(
			(task) => task.status === 'done' && task.updated_at.slice(0, 10) >= weekStart
		).length;
		const focusMinutes = get(focusSessions)
			.filter((session) => session.started_at.slice(0, 10) >= weekStart)
			.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0);
		const scheduledTasks = get(visibleTasks).filter((task) => task.scheduled_date && task.scheduled_date >= weekStart);
		const plannedDone = scheduledTasks.filter((task) => task.status === 'done').length;
		const planningAccuracy = scheduledTasks.length ? plannedDone / scheduledTasks.length : 0;
		const habitStats = get(habitProgress);
		const habitsRate =
			habitStats.length === 0
				? 0
				: habitStats.reduce((sum, item) => sum + item.completionRate, 0) / habitStats.length / 100;
		const existing = get(reviews).find((item) => item.week_start === weekStart);

		await this.saveEntity('reviews', {
			id: existing?.id,
			user_id: userId,
			week_start: weekStart,
			tasks_completed: weekDone,
			total_focus_minutes: focusMinutes,
			habits_completion_rate: Number(habitsRate.toFixed(2)),
			planning_accuracy: Number(planningAccuracy.toFixed(2)),
			priorities_next_week: priorities,
			notes: notesText
		});

		await this.clearNotification('weekly_review');
		await this.refreshNotificationsOnly();
	}

	async dismissNotification(id: string) {
		const current = get(notificationCenter).find((item) => item.id === id);
		if (!current) return;
		await db.local_notifications.put({ ...current, dismissed: true });
		await this.refreshNotificationsOnly();
	}

	async requestNotificationPermission() {
		if (!browser || !('Notification' in window)) return;
		if (Notification.permission === 'default') {
			await Notification.requestPermission();
		}
	}

	async signInWithPassword(email: string, password: string) {
		if (!supabase) return;
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			authState.update((state) => ({ ...state, message: error.message }));
		}
	}

	async signUpWithPassword(email: string, password: string, displayName: string) {
		if (!supabase) return;
		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					full_name: displayName
				}
			}
		});
		authState.update((state) => ({
			...state,
			message: error ? error.message : 'Compte cree. Verifie ta boite mail si la confirmation est active.'
		}));
	}

	async signInWithGoogle() {
		if (!supabase || !browser) return;
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback`,
				queryParams: {
					prompt: 'select_account'
				}
			}
		});
		if (error) {
			authState.update((state) => ({ ...state, message: error.message }));
		}
	}

	async signOut() {
		if (!supabase) return;
		await supabase.auth.signOut();
		await goto('/');
	}
}

export const flowpilot = new FlowPilotController();

export { clock, createDefaultProfile, getRuntimeSeconds };
