import type { TableName, UserSettings } from '$lib/types';

export const APP_NAME = 'FlowPilot';

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

export const DEFAULT_SETTINGS: UserSettings = {
	pomodoro_minutes: 25,
	break_minutes: 5,
	daily_focus_goal_minutes: 240,
	review_day: 'sunday'
};

export const VERSIONED_TABLES: TableName[] = [
	'profiles',
	'inbox_items',
	'projects',
	'tasks',
	'subtasks',
	'notes',
	'habits',
	'habit_completions',
	'focus_sessions',
	'reviews'
];

export const SYNC_TABLES: TableName[] = [
	'profiles',
	'inbox_items',
	'projects',
	'tasks',
	'subtasks',
	'notes',
	'habits',
	'habit_completions',
	'focus_sessions',
	'reviews'
];

export const TABLE_USER_FIELD: Record<TableName, 'id' | 'user_id'> = {
	profiles: 'id',
	inbox_items: 'user_id',
	projects: 'user_id',
	tasks: 'user_id',
	subtasks: 'user_id',
	notes: 'user_id',
	habits: 'user_id',
	habit_completions: 'user_id',
	focus_sessions: 'user_id',
	reviews: 'user_id'
};

export const SOFT_DELETE_TABLES = new Set<TableName>(['projects', 'tasks', 'notes', 'habits']);

export const NAV_ITEMS = [
	{ href: '/', label: 'Dashboard', short: 'Home', icon: 'H' },
	{ href: '/tasks', label: 'Taches', short: 'Tasks', icon: 'T' },
	{ href: '/agenda', label: 'Agenda', short: 'Agenda', icon: 'A' },
	{ href: '/focus', label: 'Focus', short: 'Focus', icon: 'F' }
] as const;

export const SECONDARY_ITEMS = [
	{ href: '/inbox', label: 'Inbox' },
	{ href: '/clarify', label: 'Clarifier' },
	{ href: '/projects', label: 'Projets' },
	{ href: '/habits', label: 'Habitudes' },
	{ href: '/review', label: 'Revue' },
	{ href: '/analytics', label: 'Analytics' },
	{ href: '/settings', label: 'Parametres' }
] as const;

export const WEEK_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const DAY_LABELS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const;

export const REVIEW_DAY_VALUES = [
	'sunday',
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday'
] as const;

export const REVIEW_DAY_OPTIONS = [
	{ value: 'monday', label: 'Lundi' },
	{ value: 'tuesday', label: 'Mardi' },
	{ value: 'wednesday', label: 'Mercredi' },
	{ value: 'thursday', label: 'Jeudi' },
	{ value: 'friday', label: 'Vendredi' },
	{ value: 'saturday', label: 'Samedi' },
	{ value: 'sunday', label: 'Dimanche' }
] as const;
