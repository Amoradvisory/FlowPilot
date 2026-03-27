import { addDays, format, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns';
import type { HabitCompletion, HabitProgress, Habit, Priority, Project, ProjectProgress, Task } from '$lib/types';

export const nowIso = () => new Date().toISOString();

export const todayDate = () => format(new Date(), 'yyyy-MM-dd');

export const startOfTodayIso = () => startOfDay(new Date()).toISOString();

export const addDaysIso = (date: Date | string, amount: number) =>
	addDays(typeof date === 'string' ? parseISO(date) : date, amount).toISOString();

export const dateOnlyToIso = (date: string, hour = 9, minute = 0) => {
	const instance = new Date(`${date}T00:00:00`);
	instance.setHours(hour, minute, 0, 0);
	return instance.toISOString();
};

export const parseDateSafe = (value: string | null | undefined) => {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isSameDate = (left: string | null | undefined, right: string | null | undefined) =>
	Boolean(left && right && left === right);

export const combineDateAndTime = (date: string | null, time: string | null) => {
	if (!date) return null;
	const base = new Date(`${date}T00:00:00`);

	if (time) {
		const [hours, minutes] = time.split(':').map((item) => Number(item));
		base.setHours(hours || 0, minutes || 0, 0, 0);
	}

	return base.toISOString();
};

export const minutesBetween = (startIso: string, endIso: string) =>
	Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));

export const toTimeString = (value: string | null | undefined) => {
	if (!value) return '';
	if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
	const parsed = parseDateSafe(value);
	return parsed ? format(parsed, 'HH:mm') : '';
};

export const formatShortDate = (value: string | null | undefined) => {
	const parsed = parseDateSafe(value);
	return parsed ? format(parsed, 'dd MMM') : 'Aucune date';
};

export const formatLongDate = (value: string | null | undefined) => {
	const parsed = parseDateSafe(value);
	return parsed ? format(parsed, 'dd MMM yyyy HH:mm') : 'Aucune date';
};

export const formatMinutes = (value: number) => {
	if (value < 60) return `${value} min`;
	const hours = Math.floor(value / 60);
	const minutes = value % 60;
	return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

export const normalizeText = (value: string) =>
	value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim();

export const slugify = (value: string) =>
	normalizeText(value)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

export const isOverdue = (task: Task) => {
	if (task.status === 'done' || task.status === 'cancelled') return false;
	const scheduled = combineDateAndTime(task.scheduled_date, task.scheduled_time_end || task.scheduled_time_start);
	const deadline = task.deadline;
	const compare = scheduled || deadline;

	if (!compare) return false;

	return isBefore(parseISO(compare), new Date());
};

export const taskPriorityWeight = (priority: Priority) =>
	({
		critical: 4,
		important: 3,
		normal: 2,
		low: 1
	})[priority];

export const taskSortScore = (task: Task) => {
	const overdueBonus = isOverdue(task) ? 100 : 0;
	const scheduledBonus = task.scheduled_date === todayDate() ? 20 : 0;
	const projectBonus = task.project_id ? 5 : 0;
	return overdueBonus + scheduledBonus + taskPriorityWeight(task.priority) * 10 + projectBonus;
};

export const sortTasks = (tasks: Task[]) =>
	[...tasks].sort((left, right) => {
		const leftScore = taskSortScore(left);
		const rightScore = taskSortScore(right);

		if (leftScore !== rightScore) return rightScore - leftScore;
		if ((left.position || 0) !== (right.position || 0)) return left.position - right.position;
		return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
	});

export const startOfWeekDate = (date = new Date()) => {
	const cursor = new Date(date);
	const day = cursor.getDay();
	cursor.setHours(0, 0, 0, 0);
	cursor.setDate(cursor.getDate() - ((day + 6) % 7));
	return cursor;
};

export const endOfWeekDate = (date = new Date()) => addDays(startOfWeekDate(date), 6);

export const getDateRange = (days: number) =>
	Array.from({ length: days }, (_, index) => format(addDays(new Date(), index), 'yyyy-MM-dd'));

export const getPastDateRange = (days: number) =>
	Array.from({ length: days }, (_, index) => format(subDays(new Date(), days - index - 1), 'yyyy-MM-dd'));

export const percent = (value: number, total: number) =>
	total <= 0 ? 0 : Math.round((value / total) * 100);

export const habitWindowTarget = (habit: Habit) => {
	if (habit.frequency === 'daily') return 28;
	if (habit.frequency === 'weekly_3') return 12;
	if (habit.frequency === 'weekly_5') return 20;
	return Math.max(1, habit.frequency_target * 4);
};

export const computeProjectProgress = (projects: Project[], tasks: Task[]): ProjectProgress[] =>
	projects
		.filter((project) => !project.deleted_at)
		.map((project) => {
			const linkedTasks = tasks.filter((task) => task.project_id === project.id && !task.deleted_at);
			const doneTasks = linkedTasks.filter((task) => task.status === 'done').length;
			const lastActivity = linkedTasks
				.map((task) => task.updated_at)
				.concat(project.updated_at)
				.sort()
				.at(-1);
			const staleLimit = subDays(new Date(), 7);
			const isStagnant = lastActivity ? isBefore(parseISO(lastActivity), staleLimit) : true;

			return {
				project,
				totalTasks: linkedTasks.length,
				doneTasks,
				progress: percent(doneTasks, linkedTasks.length || 1),
				isStagnant
			};
		})
		.sort((left, right) => right.progress - left.progress);

export const computeHabitProgress = (habits: Habit[], completions: HabitCompletion[]): HabitProgress[] => {
	const today = todayDate();
	const last28Days = new Set(getPastDateRange(28));

	return habits
		.filter((habit) => !habit.deleted_at)
		.map((habit) => {
			const habitCompletions = completions.filter((completion) => completion.habit_id === habit.id);
			const todayDone = habitCompletions.some((completion) => completion.completed_date === today);
			const recentDone = habitCompletions.filter((completion) => last28Days.has(completion.completed_date)).length;
			const targetWindow = habitWindowTarget(habit);

			return {
				habit,
				todayDone,
				completionRate: percent(recentDone, targetWindow),
				recentDone,
				targetWindow,
				bestStreak: habit.best_streak,
				currentStreak: habit.current_streak
			};
		})
		.sort((left, right) => Number(left.todayDone) - Number(right.todayDone));
};

export const pickNowTask = (tasks: Task[]) => sortTasks(tasks.filter((task) => task.status !== 'done')).at(0) ?? null;

export const noop = () => undefined;

export const unique = <T>(items: T[]) => Array.from(new Set(items));

export const deepEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export const compact = <T>(items: Array<T | null | undefined | false>) =>
	items.filter(Boolean) as T[];

export const isFutureIso = (value: string | null | undefined) => {
	const parsed = parseDateSafe(value);
	return parsed ? isAfter(parsed, new Date()) : false;
};
