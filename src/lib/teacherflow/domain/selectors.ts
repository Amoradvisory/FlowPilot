import { isoUtc, validateWorkspaceSnapshot } from './invariants';
import type {
	Decision,
	MemoryEntry,
	MemoryFilters,
	TodaySelection,
	WorkspaceSnapshot
} from './types';

function byId<T extends { readonly id: string }>(left: T, right: T): number {
	return left.id.localeCompare(right.id);
}

function actionable(decision: Decision): boolean {
	return decision.status !== 'applied';
}

export function selectToday(snapshot: WorkspaceSnapshot, now: Date): TodaySelection {
	validateWorkspaceSnapshot(snapshot);
	const nowIso = isoUtc(now, 'now');
	const nextSession = [...snapshot.sessions]
		.filter(
			(session) =>
				session.status === 'planned' &&
				session.scheduledFor !== undefined &&
				session.scheduledFor >= nowIso
		)
		.sort((left, right) => {
			const dateOrder = left.scheduledFor!.localeCompare(right.scheduledFor!);
			return dateOrder || byId(left, right);
		})[0];
	const decisionOrder = (left: Decision, right: Decision) => {
		const dateOrder = left.createdAt.localeCompare(right.createdAt);
		return dateOrder || byId(left, right);
	};

	return {
		...(nextSession ? { nextSession } : {}),
		unscheduledDecisions: snapshot.decisions
			.filter((decision) => actionable(decision) && !decision.targetSessionId)
			.sort(decisionOrder),
		sessionDecisions: nextSession
			? snapshot.decisions
					.filter((decision) => actionable(decision) && decision.targetSessionId === nextSession.id)
					.sort(decisionOrder)
			: []
	};
}

export function selectMemory(
	snapshot: WorkspaceSnapshot,
	filters: MemoryFilters
): readonly MemoryEntry[] {
	validateWorkspaceSnapshot(snapshot);
	const sessions = new Map(snapshot.sessions.map((session) => [session.id, session]));
	const courses = new Map(snapshot.courses.map((course) => [course.id, course]));
	const decisionsByObservation = new Map<string, Decision[]>();
	for (const decision of snapshot.decisions) {
		const current = decisionsByObservation.get(decision.observationId) ?? [];
		current.push(decision);
		decisionsByObservation.set(decision.observationId, current);
	}

	return snapshot.observations
		.flatMap((observation): MemoryEntry[] => {
			const session = sessions.get(observation.sessionId)!;
			const course = courses.get(session.courseId)!;
			const decisions = [...(decisionsByObservation.get(observation.id) ?? [])].sort(byId);
			if (filters.courseId && course.id !== filters.courseId) return [];
			if (filters.signal && observation.signal !== filters.signal) return [];
			if (filters.decisionStatus) {
				return decisions
					.filter((decision) => decision.status === filters.decisionStatus)
					.map((decision) => ({ course, session, observation, decision }));
			}
			if (decisions.length === 0) return [{ course, session, observation }];
			return decisions.map((decision) => ({ course, session, observation, decision }));
		})
		.sort((left, right) => {
			const dateOrder = right.observation.createdAt.localeCompare(left.observation.createdAt);
			return dateOrder || byId(left.observation, right.observation);
		});
}
