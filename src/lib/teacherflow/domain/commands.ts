import {
	DomainError,
	FIELD_LIMITS,
	decisionStatus,
	entityId,
	isoUtc,
	observationSignal,
	optionalString,
	requiredString,
	sessionStatus,
	validateDecision,
	validateWorkspaceSnapshot,
	workspaceId
} from './invariants';
import type {
	Clock,
	Course,
	CourseDraft,
	Decision,
	DecisionDraft,
	DecisionStatus,
	DeletionIntent,
	IdFactory,
	Observation,
	ObservationDraft,
	Session,
	SessionDraft,
	WorkspaceSnapshot
} from './types';

const systemClock: Clock = () => new Date();
const randomId: IdFactory = () => globalThis.crypto.randomUUID();

function identity(idFactory: IdFactory): string {
	return entityId(idFactory());
}

function timestamp(clock: Clock): string {
	return isoUtc(clock(), 'now');
}

export function createCourse(
	draft: CourseDraft,
	clock: Clock = systemClock,
	idFactory: IdFactory = randomId
): Course {
	const now = timestamp(clock);
	const subject = optionalString(draft.subject, 'subject', FIELD_LIMITS.courseSubject);
	return {
		id: identity(idFactory),
		workspaceId: workspaceId(draft.workspaceId),
		name: requiredString(draft.name, 'name', FIELD_LIMITS.courseName),
		...(subject ? { subject } : {}),
		colorToken: requiredString(draft.colorToken, 'colorToken', FIELD_LIMITS.colorToken),
		createdAt: now,
		updatedAt: now
	};
}

export function updateCourse(
	course: Course,
	draft: CourseDraft,
	clock: Clock = systemClock
): Course {
	const activeWorkspace = workspaceId(draft.workspaceId);
	if (course.workspaceId !== activeWorkspace) {
		throw new DomainError(
			'workspace_mismatch',
			'Course belongs to another workspace',
			'workspaceId'
		);
	}
	const now = timestamp(clock);
	if (Date.parse(now) < Date.parse(isoUtc(course.updatedAt, 'updatedAt'))) {
		throw new DomainError('invalid_date_order', 'now cannot precede updatedAt', 'now');
	}
	const subject = optionalString(draft.subject, 'subject', FIELD_LIMITS.courseSubject);
	return {
		id: entityId(course.id),
		workspaceId: activeWorkspace,
		name: requiredString(draft.name, 'name', FIELD_LIMITS.courseName),
		...(subject ? { subject } : {}),
		colorToken: requiredString(draft.colorToken, 'colorToken', FIELD_LIMITS.colorToken),
		...(course.archivedAt ? { archivedAt: isoUtc(course.archivedAt, 'archivedAt') } : {}),
		createdAt: isoUtc(course.createdAt, 'createdAt'),
		updatedAt: now
	};
}

export function archiveCourse(course: Course, clock: Clock = systemClock): Course {
	const now = timestamp(clock);
	if (Date.parse(now) < Date.parse(isoUtc(course.updatedAt, 'updatedAt'))) {
		throw new DomainError('invalid_date_order', 'now cannot precede updatedAt', 'now');
	}
	return {
		...course,
		id: entityId(course.id),
		workspaceId: workspaceId(course.workspaceId),
		archivedAt: now,
		updatedAt: now
	};
}

export function createSession(
	draft: SessionDraft,
	clock: Clock = systemClock,
	idFactory: IdFactory = randomId
): Session {
	const now = timestamp(clock);
	const scheduledFor = draft.scheduledFor ? isoUtc(draft.scheduledFor, 'scheduledFor') : undefined;
	return {
		id: identity(idFactory),
		workspaceId: workspaceId(draft.workspaceId),
		courseId: entityId(draft.courseId, 'courseId'),
		title: requiredString(draft.title, 'title', FIELD_LIMITS.sessionTitle),
		...(scheduledFor ? { scheduledFor } : {}),
		status: sessionStatus(draft.status ?? 'planned'),
		createdAt: now,
		updatedAt: now
	};
}

export function updateSession(
	session: Session,
	draft: SessionDraft,
	clock: Clock = systemClock
): Session {
	const activeWorkspace = workspaceId(draft.workspaceId);
	if (session.workspaceId !== activeWorkspace) {
		throw new DomainError(
			'workspace_mismatch',
			'Session belongs to another workspace',
			'workspaceId'
		);
	}
	const now = timestamp(clock);
	if (Date.parse(now) < Date.parse(isoUtc(session.updatedAt, 'updatedAt'))) {
		throw new DomainError('invalid_date_order', 'now cannot precede updatedAt', 'now');
	}
	const scheduledFor = draft.scheduledFor ? isoUtc(draft.scheduledFor, 'scheduledFor') : undefined;
	return {
		id: entityId(session.id),
		workspaceId: activeWorkspace,
		courseId: entityId(draft.courseId, 'courseId'),
		title: requiredString(draft.title, 'title', FIELD_LIMITS.sessionTitle),
		...(scheduledFor ? { scheduledFor } : {}),
		status: sessionStatus(draft.status ?? session.status),
		createdAt: isoUtc(session.createdAt, 'createdAt'),
		updatedAt: now
	};
}

export function createObservation(
	draft: ObservationDraft,
	clock: Clock = systemClock,
	idFactory: IdFactory = randomId
): Observation {
	const now = timestamp(clock);
	return {
		id: identity(idFactory),
		workspaceId: workspaceId(draft.workspaceId),
		sessionId: entityId(draft.sessionId, 'sessionId'),
		signal: observationSignal(draft.signal),
		note: requiredString(draft.note, 'note', FIELD_LIMITS.observationNote),
		createdAt: now,
		updatedAt: now
	};
}

export function updateObservation(
	observation: Observation,
	draft: ObservationDraft,
	clock: Clock = systemClock
): Observation {
	const activeWorkspace = workspaceId(draft.workspaceId);
	if (observation.workspaceId !== activeWorkspace) {
		throw new DomainError(
			'workspace_mismatch',
			'Observation belongs to another workspace',
			'workspaceId'
		);
	}
	const now = timestamp(clock);
	if (Date.parse(now) < Date.parse(isoUtc(observation.updatedAt, 'updatedAt'))) {
		throw new DomainError('invalid_date_order', 'now cannot precede updatedAt', 'now');
	}
	return {
		id: entityId(observation.id),
		workspaceId: activeWorkspace,
		sessionId: entityId(draft.sessionId, 'sessionId'),
		signal: observationSignal(draft.signal),
		note: requiredString(draft.note, 'note', FIELD_LIMITS.observationNote),
		createdAt: isoUtc(observation.createdAt, 'createdAt'),
		updatedAt: now
	};
}

export function createDecision(
	draft: DecisionDraft,
	clock: Clock = systemClock,
	idFactory: IdFactory = randomId
): Decision {
	const now = timestamp(clock);
	const targetSessionId = optionalString(draft.targetSessionId, 'targetSessionId', FIELD_LIMITS.id);
	return {
		id: identity(idFactory),
		workspaceId: workspaceId(draft.workspaceId),
		observationId: entityId(draft.observationId, 'observationId'),
		...(targetSessionId ? { targetSessionId } : {}),
		text: requiredString(draft.text, 'text', FIELD_LIMITS.decisionText),
		status: 'to_prepare',
		createdAt: now,
		updatedAt: now
	};
}

export function updateDecisionStatus(
	decision: Decision,
	nextStatus: DecisionStatus,
	clock: Clock = systemClock
): Decision {
	validateDecision(decision);
	decisionStatus(nextStatus);
	const expected: Partial<Record<DecisionStatus, DecisionStatus>> = {
		to_prepare: 'ready',
		ready: 'applied'
	};
	if (expected[decision.status] !== nextStatus) {
		throw new DomainError(
			'invalid_transition',
			`Cannot move a decision from ${decision.status} to ${nextStatus}`,
			'status'
		);
	}

	const now = timestamp(clock);
	if (Date.parse(now) < Date.parse(isoUtc(decision.updatedAt, 'updatedAt'))) {
		throw new DomainError('invalid_date_order', 'now cannot precede updatedAt', 'now');
	}
	const updated: Decision = {
		...decision,
		status: nextStatus,
		...(nextStatus === 'applied' ? { appliedAt: now } : {}),
		updatedAt: now
	};
	return validateDecision(updated);
}

export function updateDecisionText(
	decision: Decision,
	text: string,
	clock: Clock = systemClock
): Decision {
	validateDecision(decision);
	const now = timestamp(clock);
	if (Date.parse(now) < Date.parse(isoUtc(decision.updatedAt, 'updatedAt'))) {
		throw new DomainError('invalid_date_order', 'now cannot precede updatedAt', 'now');
	}
	return validateDecision({
		...decision,
		text: requiredString(text, 'text', FIELD_LIMITS.decisionText),
		updatedAt: now
	});
}

function emptyDeletionSet() {
	return { courseIds: [], sessionIds: [], observationIds: [], decisionIds: [] };
}

function sorted(values: Iterable<string>): string[] {
	return [...values].sort(compareOrdinal);
}

function compareOrdinal(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

export function planObservationDeletion(
	snapshot: WorkspaceSnapshot,
	observationId: string
): DeletionIntent {
	validateWorkspaceSnapshot(snapshot);
	const id = entityId(observationId, 'observationId');
	if (!snapshot.observations.some((observation) => observation.id === id)) {
		throw new DomainError('relation_not_found', 'Observation not found', 'observationId');
	}
	return {
		kind: 'delete_observation',
		workspaceId: snapshot.workspaceId,
		delete: {
			...emptyDeletionSet(),
			observationIds: [id],
			decisionIds: sorted(
				snapshot.decisions
					.filter((decision) => decision.observationId === id)
					.map((decision) => decision.id)
			)
		},
		clearDecisionTargetIds: [],
		requiresDetailedConfirmation: false
	};
}

export function planCourseDeletion(snapshot: WorkspaceSnapshot, courseId: string): DeletionIntent {
	validateWorkspaceSnapshot(snapshot);
	const id = entityId(courseId, 'courseId');
	if (!snapshot.courses.some((course) => course.id === id)) {
		throw new DomainError('relation_not_found', 'Course not found', 'courseId');
	}
	const sessionIds = new Set(
		snapshot.sessions.filter((session) => session.courseId === id).map((session) => session.id)
	);
	const observationIds = new Set(
		snapshot.observations
			.filter((observation) => sessionIds.has(observation.sessionId))
			.map((observation) => observation.id)
	);
	const decisionIds = new Set(
		snapshot.decisions
			.filter((decision) => observationIds.has(decision.observationId))
			.map((decision) => decision.id)
	);
	const clearDecisionTargetIds = snapshot.decisions
		.filter(
			(decision) =>
				!decisionIds.has(decision.id) &&
				decision.targetSessionId !== undefined &&
				sessionIds.has(decision.targetSessionId)
		)
		.map((decision) => decision.id);

	return {
		kind: 'delete_course',
		workspaceId: snapshot.workspaceId,
		delete: {
			courseIds: [id],
			sessionIds: sorted(sessionIds),
			observationIds: sorted(observationIds),
			decisionIds: sorted(decisionIds)
		},
		clearDecisionTargetIds: sorted(clearDecisionTargetIds),
		requiresDetailedConfirmation: true
	};
}

export function planSessionDeletion(
	snapshot: WorkspaceSnapshot,
	sessionId: string
): DeletionIntent {
	validateWorkspaceSnapshot(snapshot);
	const id = entityId(sessionId, 'sessionId');
	if (!snapshot.sessions.some((session) => session.id === id)) {
		throw new DomainError('relation_not_found', 'Session not found', 'sessionId');
	}
	const observationIds = new Set(
		snapshot.observations.filter((observation) => observation.sessionId === id).map(({ id }) => id)
	);
	const decisionIds = new Set(
		snapshot.decisions
			.filter((decision) => observationIds.has(decision.observationId))
			.map(({ id }) => id)
	);
	return {
		kind: 'delete_session',
		workspaceId: snapshot.workspaceId,
		delete: {
			courseIds: [],
			sessionIds: [id],
			observationIds: sorted(observationIds),
			decisionIds: sorted(decisionIds)
		},
		clearDecisionTargetIds: sorted(
			snapshot.decisions
				.filter((decision) => !decisionIds.has(decision.id) && decision.targetSessionId === id)
				.map(({ id }) => id)
		),
		requiresDetailedConfirmation: true
	};
}
