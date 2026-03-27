import Dexie, { type Table } from 'dexie';
import type {
	ConflictLog,
	FocusSession,
	Habit,
	HabitCompletion,
	InboxItem,
	LocalMeta,
	LocalNotification,
	Note,
	Profile,
	Project,
	Review,
	Subtask,
	SyncQueueRecord,
	Task
} from '$lib/types';

class FlowPilotDB extends Dexie {
	profiles!: Table<Profile, string>;
	inbox_items!: Table<InboxItem, string>;
	projects!: Table<Project, string>;
	tasks!: Table<Task, string>;
	subtasks!: Table<Subtask, string>;
	notes!: Table<Note, string>;
	habits!: Table<Habit, string>;
	habit_completions!: Table<HabitCompletion, string>;
	focus_sessions!: Table<FocusSession, string>;
	reviews!: Table<Review, string>;
	sync_queue!: Table<SyncQueueRecord, string>;
	local_conflicts!: Table<ConflictLog, string>;
	local_notifications!: Table<LocalNotification, string>;
	local_meta!: Table<LocalMeta, string>;

	constructor() {
		super('flowpilot-db');

		this.version(1).stores({
			profiles: '&id, updated_at, version',
			inbox_items: '&id, user_id, status, updated_at, created_at',
			projects: '&id, user_id, status, updated_at, deadline',
			tasks:
				'&id, user_id, status, priority, scheduled_date, project_id, updated_at, deadline, [user_id+status], [user_id+scheduled_date]',
			subtasks: '&id, user_id, task_id, updated_at',
			notes: '&id, user_id, project_id, updated_at',
			habits: '&id, user_id, updated_at, deleted_at',
			habit_completions: '&id, user_id, habit_id, completed_date, updated_at',
			focus_sessions: '&id, user_id, task_id, started_at, updated_at',
			reviews: '&id, user_id, week_start, updated_at',
			sync_queue: '&id, user_id, table_name, record_id, status, created_at, updated_at, [user_id+status], [table_name+record_id]',
			local_conflicts: '&id, user_id, table_name, record_id, created_at',
			local_notifications: '&id, user_id, kind, created_at, dismissed',
			local_meta: '&key, user_id, updated_at'
		});
	}
}

export const db = new FlowPilotDB();
