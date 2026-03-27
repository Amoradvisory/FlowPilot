export type Priority = 'critical' | 'important' | 'normal' | 'low';

export type Energy = 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export type ProjectStatus = 'active' | 'paused' | 'done' | 'abandoned';

export type InboxStatus = 'pending' | 'clarified' | 'deleted';

export type HabitFrequency = 'daily' | 'weekly_3' | 'weekly_5' | 'custom';

export type SyncOperation = 'insert' | 'update' | 'delete';

export type QueueStatus = 'pending' | 'processing' | 'failed' | 'done';

export type TableName =
	| 'profiles'
	| 'inbox_items'
	| 'projects'
	| 'tasks'
	| 'subtasks'
	| 'notes'
	| 'habits'
	| 'habit_completions'
	| 'focus_sessions'
	| 'reviews';

export interface UserSettings {
	pomodoro_minutes: number;
	break_minutes: number;
	daily_focus_goal_minutes: number;
	review_day: string;
}

export interface Profile {
	id: string;
	display_name: string | null;
	settings: UserSettings;
	created_at: string;
	updated_at: string;
	version: number;
}

export interface InboxItem {
	id: string;
	user_id: string;
	raw_text: string;
	parsed_date: string | null;
	parsed_priority: Priority | null;
	parsed_tags: string[];
	project_id: string | null;
	status: InboxStatus;
	version: number;
	created_at: string;
	updated_at: string;
}

export interface Project {
	id: string;
	user_id: string;
	title: string;
	description: string | null;
	status: ProjectStatus;
	deadline: string | null;
	position: number;
	version: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface Task {
	id: string;
	user_id: string;
	title: string;
	description: string | null;
	priority: Priority;
	estimated_duration: number | null;
	energy: Energy | null;
	context: string | null;
	project_id: string | null;
	deadline: string | null;
	scheduled_date: string | null;
	scheduled_time_start: string | null;
	scheduled_time_end: string | null;
	status: TaskStatus;
	position: number;
	total_focus_minutes: number;
	version: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface Subtask {
	id: string;
	task_id: string;
	user_id: string;
	title: string;
	is_done: boolean;
	position: number;
	version: number;
	created_at: string;
	updated_at: string;
}

export interface Note {
	id: string;
	user_id: string;
	title: string;
	content: string | null;
	project_id: string | null;
	tags: string[];
	version: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface Habit {
	id: string;
	user_id: string;
	title: string;
	frequency: HabitFrequency;
	frequency_target: number;
	current_streak: number;
	best_streak: number;
	position: number;
	version: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface HabitCompletion {
	id: string;
	habit_id: string;
	user_id: string;
	completed_date: string;
	version: number;
	created_at: string;
	updated_at: string;
}

export interface FocusSession {
	id: string;
	user_id: string;
	task_id: string;
	started_at: string;
	ended_at: string | null;
	duration_minutes: number | null;
	completed: boolean;
	created_at: string;
	updated_at: string;
	version: number;
}

export interface Review {
	id: string;
	user_id: string;
	week_start: string;
	tasks_completed: number;
	total_focus_minutes: number;
	habits_completion_rate: number;
	planning_accuracy: number;
	priorities_next_week: string[];
	notes: string | null;
	version: number;
	created_at: string;
	updated_at: string;
}

export interface SyncPayload<T extends Record<string, unknown> = Record<string, unknown>> {
	data: T;
	expectedVersion?: number;
	baseSnapshot?: T | null;
	conflictFields?: string[];
	conflictNote?: string | null;
}

export interface SyncQueueRecord {
	id: string;
	user_id: string;
	table_name: TableName;
	record_id: string;
	operation: SyncOperation;
	payload: SyncPayload;
	status: QueueStatus;
	retry_count: number;
	created_at: string;
	updated_at: string;
}

export interface ConflictLog {
	id: string;
	user_id: string;
	table_name: TableName;
	record_id: string;
	fields: string[];
	local_snapshot: Record<string, unknown>;
	remote_snapshot: Record<string, unknown>;
	resolved_snapshot: Record<string, unknown>;
	created_at: string;
}

export interface LocalNotification {
	id: string;
	user_id: string;
	kind: 'inbox_backlog' | 'stagnant_project' | 'weekly_review' | 'focus_reminder' | 'focus_done';
	title: string;
	body: string;
	dismissed: boolean;
	created_at: string;
}

export interface LocalMeta {
	key: string;
	user_id: string;
	value: Record<string, unknown>;
	updated_at: string;
}

export interface SessionIdentity {
	id: string;
	email: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	provider: string | null;
}

export interface AuthState {
	ready: boolean;
	mode: 'local' | 'supabase';
	configured: boolean;
	user: SessionIdentity | null;
	message: string | null;
}

export interface SyncState {
	running: boolean;
	pending: number;
	lastSyncedAt: string | null;
	lastError: string | null;
	mode: 'local-only' | 'online-sync';
}

export interface ShellState {
	secondaryMenuOpen: boolean;
	quickCaptureOpen: boolean;
	quickCaptureText: string;
}

export interface FocusRuntime {
	sessionId: string | null;
	taskId: string | null;
	startedAt: string | null;
	pauseStartedAt: string | null;
	pausedSeconds: number;
	plannedMinutes: number;
	mode: 'idle' | 'running' | 'paused' | 'prompt';
}

export interface ParsedInboxDraft {
	raw_text: string;
	parsed_date: string | null;
	parsed_priority: Priority | null;
	parsed_tags: string[];
	project_id: string | null;
}

export interface ClarifiedTaskDraft {
	title: string;
	description?: string | null;
	priority?: Priority;
	estimated_duration?: number | null;
	energy?: Energy | null;
	context?: string | null;
	project_id?: string | null;
	deadline?: string | null;
	scheduled_date?: string | null;
	scheduled_time_start?: string | null;
	scheduled_time_end?: string | null;
}

export interface DashboardPrompt {
	id: string;
	title: string;
	body: string;
	actionHref: string;
	actionLabel: string;
	tone: 'info' | 'warning';
}

export interface ProjectProgress {
	project: Project;
	totalTasks: number;
	doneTasks: number;
	progress: number;
	isStagnant: boolean;
}

export interface HabitProgress {
	habit: Habit;
	todayDone: boolean;
	completionRate: number;
	recentDone: number;
	targetWindow: number;
	bestStreak: number;
	currentStreak: number;
}
