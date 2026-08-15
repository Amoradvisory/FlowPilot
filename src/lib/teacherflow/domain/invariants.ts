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
	| 'non_canonical'
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

function assertCanonical(value: string, canonical: string, field: string): string {
	if (value !== canonical) {
		throw new DomainError('non_canonical', `${field} must use its canonical form`, field);
	}
	return canonical;
}

function canonicalRequiredString(value: string, field: string, maximum: number): string {
	return assertCanonical(value, requiredString(value, field, maximum), field);
}

function canonicalOptionalString(
	value: string | undefined,
	field: string,
	maximum: number
): string | undefined {
	if (value === undefined) return undefined;
	const normalized = optionalString(value, field, maximum);
	if (normalized === undefined) {
		throw new DomainError('non_canonical', `${field} must be omitted instead of empty`, field);
	}
	return assertCanonical(value, normalized, field);
}

function canonicalIsoUtc(value: string, field: string): string {
	if (!normalizeWhitespace(value)) {
		throw new DomainError('non_canonical', `${field} must be omitted instead of empty`, field);
	}
	return assertCanonical(value, isoUtc(value, field), field);
}

function canonicalEntityId(value: string, field = 'id'): string {
	return canonicalRequiredString(value, field, FIELD_LIMITS.id);
}

function canonicalWorkspaceId(value: string): string {
	return canonicalRequiredString(value, 'workspaceId', FIELD_LIMITS.workspaceId);
}

function uniqueById<T extends { readonly id: string }>(values: readonly T[]): Map<string, T> {
	const result = new Map<string, T>();
	for (const value of values) {
		const id = canonicalEntityId(value.id);
		if (result.has(id)) throw new DomainError('duplicate_id', `Duplicate id: ${id}`, 'id');
		result.set(id, value);
	}
	return result;
}

function assertWorkspace(actual: string, expected: string, field: string): void {
	if (canonicalWorkspaceId(actual) !== expected) {
		throw new DomainError('workspace_mismatch', `${field} belongs to another workspace`, field);
	}
}

function relation<T>(map: ReadonlyMap<string, T>, id: string, field: string): T {
	const related = map.get(canonicalEntityId(id, field));
	if (!related) throw new DomainError('relation_not_found', `Missing relation: ${field}`, field);
	return related;
}

function validateDecisionDates(decision: Decision): void {
	const createdAt = canonicalIsoUtc(decision.createdAt, 'createdAt');
	const updatedAt = canonicalIsoUtc(decision.updatedAt, 'updatedAt');
	assertChronology(createdAt, updatedAt);
	const appliedAt =
		decision.appliedAt === undefined ? undefined : canonicalIsoUtc(decision.appliedAt, 'appliedAt');
	if (decision.status === 'applied') {
		if (appliedAt === undefined) {
			throw new DomainError(
				'required',
				'appliedAt is required for an applied decision',
				'appliedAt'
			);
		}
		if (
			Date.parse(appliedAt) < Date.parse(createdAt) ||
			Date.parse(appliedAt) > Date.parse(updatedAt)
		) {
			throw new DomainError(
				'invalid_date_order',
				'appliedAt must be between createdAt and updatedAt',
				'appliedAt'
			);
		}
	} else if (appliedAt !== undefined) {
		throw new DomainError(
			'invalid_status',
			'Only applied decisions can have appliedAt',
			'appliedAt'
		);
	}
}

export function validateDecision(decision: Decision): Decision {
	canonicalEntityId(decision.id);
	canonicalWorkspaceId(decision.workspaceId);
	canonicalEntityId(decision.observationId, 'observationId');
	canonicalOptionalString(decision.targetSessionId, 'targetSessionId', FIELD_LIMITS.id);
	canonicalRequiredString(decision.text, 'text', FIELD_LIMITS.decisionText);
	decisionStatus(decision.status);
	validateDecisionDates(decision);
	return decision;
}

export function validateWorkspaceSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
	const activeWorkspace = canonicalWorkspaceId(snapshot.workspaceId);
	const courses = uniqueById(snapshot.courses);
	const sessions = uniqueById(snapshot.sessions);
	const observations = uniqueById(snapshot.observations);
	uniqueById(snapshot.decisions);

	for (const course of snapshot.courses) {
		assertWorkspace(course.workspaceId, activeWorkspace, 'workspaceId');
		canonicalRequiredString(course.name, 'name', FIELD_LIMITS.courseName);
		canonicalOptionalString(course.subject, 'subject', FIELD_LIMITS.courseSubject);
		canonicalRequiredString(course.colorToken, 'colorToken', FIELD_LIMITS.colorToken);
		const createdAt = canonicalIsoUtc(course.createdAt, 'createdAt');
		const updatedAt = canonicalIsoUtc(course.updatedAt, 'updatedAt');
		assertChronology(createdAt, updatedAt);
		if (course.archivedAt !== undefined) canonicalIsoUtc(course.archivedAt, 'archivedAt');
	}

	for (const session of snapshot.sessions) {
		assertWorkspace(session.workspaceId, activeWorkspace, 'workspaceId');
		const course = relation(courses, session.courseId, 'courseId');
		assertWorkspace(course.workspaceId, session.workspaceId, 'courseId');
		canonicalRequiredString(session.title, 'title', FIELD_LIMITS.sessionTitle);
		sessionStatus(session.status);
		if (session.scheduledFor !== undefined) {
			canonicalIsoUtc(session.scheduledFor, 'scheduledFor');
		}
		const createdAt = canonicalIsoUtc(session.createdAt, 'createdAt');
		const updatedAt = canonicalIsoUtc(session.updatedAt, 'updatedAt');
		assertChronology(createdAt, updatedAt);
	}

	for (const observation of snapshot.observations) {
		assertWorkspace(observation.workspaceId, activeWorkspace, 'workspaceId');
		const session = relation(sessions, observation.sessionId, 'sessionId');
		assertWorkspace(session.workspaceId, observation.workspaceId, 'sessionId');
		observationSignal(observation.signal);
		canonicalRequiredString(observation.note, 'note', FIELD_LIMITS.observationNote);
		const createdAt = canonicalIsoUtc(observation.createdAt, 'createdAt');
		const updatedAt = canonicalIsoUtc(observation.updatedAt, 'updatedAt');
		assertChronology(createdAt, updatedAt);
	}

	for (const decision of snapshot.decisions) {
		validateDecision(decision);
		assertWorkspace(decision.workspaceId, activeWorkspace, 'workspaceId');
		const observation = relation(observations, decision.observationId, 'observationId');
		assertWorkspace(observation.workspaceId, decision.workspaceId, 'observationId');
		if (decision.targetSessionId !== undefined) {
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
