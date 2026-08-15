import { DomainError, validateWorkspaceSnapshot } from '../domain/invariants';
import type { Course, Decision, Observation, Session, WorkspaceSnapshot } from '../domain/types';

export const TEACHERFLOW_BACKUP_FORMAT = 'teacherflow-backup';
export const TEACHERFLOW_BACKUP_VERSION = 1;
export const TEACHERFLOW_BACKUP_MAX_BYTES = 1_000_000;

export interface TeacherFlowBackup extends WorkspaceSnapshot {
	readonly format: typeof TEACHERFLOW_BACKUP_FORMAT;
	readonly formatVersion: typeof TEACHERFLOW_BACKUP_VERSION;
	readonly appVersion: string;
	readonly exportedAt: string;
	readonly workspaceId: 'personal';
	readonly courses: readonly Course[];
	readonly sessions: readonly Session[];
	readonly observations: readonly Observation[];
	readonly decisions: readonly Decision[];
}

export type BackupErrorCode =
	| 'too_large'
	| 'malformed'
	| 'invalid_structure'
	| 'unsafe_key'
	| 'invalid_domain';

export class BackupError extends Error {
	readonly name = 'BackupError';

	constructor(
		readonly code: BackupErrorCode,
		readonly instruction: string
	) {
		super(instruction);
	}
}

export type ParseResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly reason: BackupErrorCode; readonly error: BackupError };

function failure(code: BackupErrorCode, instruction: string): ParseResult<never> {
	return { ok: false, reason: code, error: new BackupError(code, instruction) };
}

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function exactKeys(
	value: Record<string, unknown>,
	required: readonly string[],
	optional: readonly string[] = []
): boolean {
	const allowed = new Set([...required, ...optional]);
	const keys = Object.keys(value);
	return (
		keys.length >= required.length &&
		required.every((key) => Object.hasOwn(value, key)) &&
		keys.every((key) => allowed.has(key))
	);
}

function unsafeKeys(value: Record<string, unknown>): boolean {
	return ['__proto__', 'prototype', 'constructor'].some((key) => Object.hasOwn(value, key));
}

function entity(
	value: unknown,
	required: readonly string[],
	optional: readonly string[] = []
): BackupError | undefined {
	if (!isPlainObject(value))
		return new BackupError('invalid_structure', 'La sauvegarde contient un objet invalide.');
	if (unsafeKeys(value))
		return new BackupError('unsafe_key', 'La sauvegarde contient une clé interdite.');
	if (!exactKeys(value, required, optional))
		return new BackupError(
			'invalid_structure',
			'La sauvegarde contient des champs inconnus ou manquants.'
		);
	return undefined;
}

function entityArray(
	value: unknown,
	required: readonly string[],
	optional: readonly string[] = []
): BackupError | undefined {
	if (!Array.isArray(value))
		return new BackupError('invalid_structure', 'La sauvegarde contient une liste invalide.');
	for (const item of value) {
		const error = entity(item, required, optional);
		if (error) return error;
	}
	return undefined;
}

function validShape(value: Record<string, unknown>): BackupError | undefined {
	if (unsafeKeys(value))
		return new BackupError('unsafe_key', 'La sauvegarde contient une clé interdite.');
	if (
		!exactKeys(value, [
			'format',
			'formatVersion',
			'appVersion',
			'exportedAt',
			'workspaceId',
			'courses',
			'sessions',
			'observations',
			'decisions'
		])
	) {
		return new BackupError(
			'invalid_structure',
			'Le format de sauvegarde est incomplet ou contient des champs inconnus.'
		);
	}
	if (
		value.format !== TEACHERFLOW_BACKUP_FORMAT ||
		value.formatVersion !== TEACHERFLOW_BACKUP_VERSION ||
		value.workspaceId !== 'personal' ||
		typeof value.appVersion !== 'string' ||
		!value.appVersion.trim() ||
		typeof value.exportedAt !== 'string'
	) {
		return new BackupError(
			'invalid_structure',
			'Cette sauvegarde ne correspond pas à une version personnelle prise en charge.'
		);
	}
	const arrays: Array<{
		value: unknown;
		required: readonly string[];
		optional?: readonly string[];
	}> = [
		{
			value: value.courses,
			required: ['id', 'workspaceId', 'name', 'colorToken', 'createdAt', 'updatedAt'],
			optional: ['subject', 'archivedAt']
		},
		{
			value: value.sessions,
			required: ['id', 'workspaceId', 'courseId', 'title', 'status', 'createdAt', 'updatedAt'],
			optional: ['scheduledFor']
		},
		{
			value: value.observations,
			required: ['id', 'workspaceId', 'sessionId', 'signal', 'note', 'createdAt', 'updatedAt']
		},
		{
			value: value.decisions,
			required: ['id', 'workspaceId', 'observationId', 'text', 'status', 'createdAt', 'updatedAt'],
			optional: ['targetSessionId', 'appliedAt']
		}
	];
	for (const array of arrays) {
		const error = entityArray(array.value, array.required, array.optional);
		if (error) return error;
	}
	return undefined;
}

function toSnapshot(value: Record<string, unknown>): WorkspaceSnapshot {
	return {
		workspaceId: 'personal',
		courses: value.courses as Course[],
		sessions: value.sessions as Session[],
		observations: value.observations as Observation[],
		decisions: value.decisions as Decision[]
	};
}

export function exportWorkspace(
	snapshot: WorkspaceSnapshot,
	appVersion: string
): TeacherFlowBackup {
	if (snapshot.workspaceId !== 'personal') {
		throw new DomainError(
			'workspace_mismatch',
			'Only personal data can be exported',
			'workspaceId'
		);
	}
	validateWorkspaceSnapshot(snapshot);
	if (!appVersion.trim()) throw new DomainError('required', 'appVersion is required', 'appVersion');
	return {
		format: TEACHERFLOW_BACKUP_FORMAT,
		formatVersion: TEACHERFLOW_BACKUP_VERSION,
		appVersion: appVersion.trim(),
		exportedAt: new Date().toISOString(),
		workspaceId: 'personal',
		courses: snapshot.courses.map((item) => ({ ...item })),
		sessions: snapshot.sessions.map((item) => ({ ...item })),
		observations: snapshot.observations.map((item) => ({ ...item })),
		decisions: snapshot.decisions.map((item) => ({ ...item }))
	};
}

export function serializeTeacherFlowBackup(backup: TeacherFlowBackup): string {
	const serialized = JSON.stringify(backup);
	if (byteLength(serialized) > TEACHERFLOW_BACKUP_MAX_BYTES) {
		throw new BackupError('too_large', 'La sauvegarde dépasse la taille maximale de 1 Mo.');
	}
	return serialized;
}

export function parseTeacherFlowBackup(input: string): ParseResult<TeacherFlowBackup> {
	if (byteLength(input) > TEACHERFLOW_BACKUP_MAX_BYTES) {
		return failure('too_large', 'Le fichier dépasse la taille maximale de 1 Mo.');
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch {
		return failure('malformed', 'Le fichier ne contient pas du JSON lisible.');
	}
	if (!isPlainObject(parsed))
		return failure('invalid_structure', 'La sauvegarde doit être un objet JSON.');
	const shapeError = validShape(parsed);
	if (shapeError) return { ok: false, reason: shapeError.code, error: shapeError };
	try {
		const exportedAt = new Date(parsed.exportedAt as string);
		if (Number.isNaN(exportedAt.getTime()) || exportedAt.toISOString() !== parsed.exportedAt) {
			return failure('invalid_domain', 'La date d’export doit être une date UTC ISO valide.');
		}
		validateWorkspaceSnapshot(toSnapshot(parsed));
		return { ok: true, value: parsed as unknown as TeacherFlowBackup };
	} catch {
		return failure('invalid_domain', 'La sauvegarde contient des données ou relations invalides.');
	}
}
