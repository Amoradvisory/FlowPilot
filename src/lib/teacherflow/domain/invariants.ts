import type {
	Decision,
	DecisionStatus,
	IsoUtcString,
	ObservationSignal,
	SessionStatus,
	WorkspaceSnapshot
} from './types';

export const FIELD_LIMITS = {
	id: 120,
	workspaceId: 120,
	courseName: 80,
	courseSubject: 80,
	colorToken: 40,
	sessionTitle: 120,
	observationNote: 600,
	decisionText: 300
} as const;

export type DomainErrorCode =
	| 'required'
	| 'too_long'
	| 'invalid_date'
	| 'invalid_date_order'
	| 'invalid_signal'
	| 'invalid_status'
	| 'invalid_transition'
	| 'relation_not_found'
	| 'workspace_mismatch'
	| 'duplicate_id'
	| 'target_not_future';

export class DomainError extends Error {
	readonly name = 'DomainError';

	constructor(
		readonly code: DomainErrorCode,
		message: string,
		readonly field?: string
	) {
		super(message);
	}
}

export function normalizeWhitespace(value: string): string {
	return value.trim().replace(/\s+/gu, ' ');
}

export function requiredString(value: string, field: string, maximum: number): string {
	const normalized = normalizeWhitespace(value);
	if (!normalized) throw new DomainError('required', `${field} is required`, field);
	if (normalized.length > maximum) {
		throw new DomainError('too_long', `${field} must be at most ${maximum} characters`, field);
	}
	return normalized;
}

export function optionalString(
	value: string | undefined,
	field: string,
	maximum: number
): string | undefined {
	if (value === undefined) return undefined;
	const normalized = normalizeWhitespace(value);
	if (!normalized) return undefined;
	if (normalized.length > maximum) {
		throw new DomainError('too_long', `${field} must be at most ${maximum} characters`, field);
	}
	return normalized;
}

export function entityId(value: string, field = 'id'): string {
	return requiredString(value, field, FIELD_LIMITS.id);
}

export function workspaceId(value: string): string {
	return requiredString(value, 'workspaceId', FIELD_LIMITS.workspaceId);
}

export function isoUtc(value: string | Date, field: string): IsoUtcString {
	const date = value instanceof Date ? value : new Date(normalizeWhitespace(value));
	if (Number.isNaN(date.getTime())) {
		throw new DomainError('invalid_date', `${field} must be a valid date`, field);
	}
	return date.toISOString();
}

export function assertChronology(createdAt: string, updatedAt: string): void {
	if (Date.parse(updatedAt) < Date.parse(createdAt)) {
		throw new DomainError('invalid_date_order', 'updatedAt cannot precede createdAt', 'updatedAt');
	}
}

export function observationSignal(value: ObservationSignal): ObservationSignal {
	if (!(['keep', 'adjust', 'verify'] as readonly unknown[]).includes(value)) {
		throw new DomainError('invalid_signal', 'Unknown observation signal', 'signal');
	}
	return value;
}

export function sessionStatus(value: SessionStatus): SessionStatus {
	if (!(['planned', 'taught', 'completed'] as readonly unknown[]).includes(value)) {
		throw new DomainError('invalid_status', 'Unknown session status', 'status');
	}
	return value;
}

export function decisionStatus(value: DecisionStatus): DecisionStatus {
	if (!(['to_prepare', 'ready', 'applied'] as readonly unknown[]).includes(value)) {
		throw new DomainError('invalid_status', 'Unknown decision status', 'status');
	}
	return value;
}

function uniqueById<T extends { readonly id: string }>(values: readonly T[]): Map<string, T> {
	const result = new Map<string, T>();
	for (const value of values) {
		const id = entityId(value.id);
		if (result.has(id)) throw new DomainError('duplicate_id', `Duplicate id: ${id}`, 'id');
		result.set(id, value);
	}
	return result;
}

function assertWorkspace(actual: string, expected: string, field: string): void {
	if (workspaceId(actual) !== expected) {
		throw new DomainError('workspace_mismatch', `${field} belongs to another workspace`, field);
	}
}

function relation<T>(map: ReadonlyMap<string, T>, id: string, field: string): T {
	const related = map.get(entityId(id, field));
	if (!related) throw new DomainError('relation_not_found', `Missing relation: ${field}`, field);
	return related;
}

function validateDecisionDates(decision: Decision): void {
	const createdAt = isoUtc(decision.createdAt, 'createdAt');
	const updatedAt = isoUtc(decision.updatedAt, 'updatedAt');
	assertChronology(createdAt, updatedAt);
	if (decision.status === 'applied') {
		if (!decision.appliedAt) {
			throw new DomainError(
				'required',
				'appliedAt is required for an applied decision',
				'appliedAt'
			);
		}
		const appliedAt = isoUtc(decision.appliedAt, 'appliedAt');
		if (Date.parse(appliedAt) < Date.parse(createdAt)) {
			throw new DomainError(
				'invalid_date_order',
				'appliedAt cannot precede createdAt',
				'appliedAt'
			);
		}
	} else if (decision.appliedAt) {
		throw new DomainError(
			'invalid_status',
			'Only applied decisions can have appliedAt',
			'appliedAt'
		);
	}
}

export function validateWorkspaceSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
	const activeWorkspace = workspaceId(snapshot.workspaceId);
	const courses = uniqueById(snapshot.courses);
	const sessions = uniqueById(snapshot.sessions);
	const observations = uniqueById(snapshot.observations);
	uniqueById(snapshot.decisions);

	for (const course of snapshot.courses) {
		assertWorkspace(course.workspaceId, activeWorkspace, 'workspaceId');
		requiredString(course.name, 'name', FIELD_LIMITS.courseName);
		optionalString(course.subject, 'subject', FIELD_LIMITS.courseSubject);
		requiredString(course.colorToken, 'colorToken', FIELD_LIMITS.colorToken);
		const createdAt = isoUtc(course.createdAt, 'createdAt');
		const updatedAt = isoUtc(course.updatedAt, 'updatedAt');
		assertChronology(createdAt, updatedAt);
		if (course.archivedAt) isoUtc(course.archivedAt, 'archivedAt');
	}

	for (const session of snapshot.sessions) {
		assertWorkspace(session.workspaceId, activeWorkspace, 'workspaceId');
		const course = relation(courses, session.courseId, 'courseId');
		assertWorkspace(course.workspaceId, session.workspaceId, 'courseId');
		requiredString(session.title, 'title', FIELD_LIMITS.sessionTitle);
		sessionStatus(session.status);
		if (session.scheduledFor) isoUtc(session.scheduledFor, 'scheduledFor');
		const createdAt = isoUtc(session.createdAt, 'createdAt');
		const updatedAt = isoUtc(session.updatedAt, 'updatedAt');
		assertChronology(createdAt, updatedAt);
	}

	for (const observation of snapshot.observations) {
		assertWorkspace(observation.workspaceId, activeWorkspace, 'workspaceId');
		const session = relation(sessions, observation.sessionId, 'sessionId');
		assertWorkspace(session.workspaceId, observation.workspaceId, 'sessionId');
		observationSignal(observation.signal);
		requiredString(observation.note, 'note', FIELD_LIMITS.observationNote);
		const createdAt = isoUtc(observation.createdAt, 'createdAt');
		const updatedAt = isoUtc(observation.updatedAt, 'updatedAt');
		assertChronology(createdAt, updatedAt);
	}

	for (const decision of snapshot.decisions) {
		assertWorkspace(decision.workspaceId, activeWorkspace, 'workspaceId');
		const observation = relation(observations, decision.observationId, 'observationId');
		assertWorkspace(observation.workspaceId, decision.workspaceId, 'observationId');
		requiredString(decision.text, 'text', FIELD_LIMITS.decisionText);
		decisionStatus(decision.status);
		validateDecisionDates(decision);
		if (decision.targetSessionId) {
			const target = relation(sessions, decision.targetSessionId, 'targetSessionId');
			assertWorkspace(target.workspaceId, decision.workspaceId, 'targetSessionId');
			if (
				!target.scheduledFor ||
				Date.parse(target.scheduledFor) <= Date.parse(observation.createdAt)
			) {
				throw new DomainError(
					'target_not_future',
					'A target session must be scheduled after the observation',
					'targetSessionId'
				);
			}
		}
	}

	return snapshot;
}
