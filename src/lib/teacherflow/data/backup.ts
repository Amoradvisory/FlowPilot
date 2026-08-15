import { DomainError, validateWorkspaceSnapshot } from '../domain/invariants';
import type { Course, Decision, Observation, Session, WorkspaceSnapshot } from '../domain/types';

export const TEACHERFLOW_BACKUP_FORMAT = 'teacherflow-backup';
export const TEACHERFLOW_BACKUP_VERSION = 1;
/** A deliberately modest ceiling: imports are local recovery artifacts, never a bulk data channel. */
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

export type ParseResult<Value> =
	| { readonly ok: true; readonly value: Value }
	| { readonly ok: false; readonly reason: 'too_large' | 'malformed' | 'invalid' };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function backupSnapshot(value: Record<string, unknown>): WorkspaceSnapshot | undefined {
	if (
		!Array.isArray(value.courses) ||
		!Array.isArray(value.sessions) ||
		!Array.isArray(value.observations) ||
		!Array.isArray(value.decisions)
	) {
		return undefined;
	}
	return {
		workspaceId: value.workspaceId as string,
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
		courses: [...snapshot.courses],
		sessions: [...snapshot.sessions],
		observations: [...snapshot.observations],
		decisions: [...snapshot.decisions]
	};
}

export function parseTeacherFlowBackup(input: string): ParseResult<TeacherFlowBackup> {
	if (new TextEncoder().encode(input).byteLength > TEACHERFLOW_BACKUP_MAX_BYTES) {
		return { ok: false, reason: 'too_large' };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch {
		return { ok: false, reason: 'malformed' };
	}
	if (!isRecord(parsed)) return { ok: false, reason: 'invalid' };
	if (
		!exactKeys(parsed, [
			'format',
			'formatVersion',
			'appVersion',
			'exportedAt',
			'workspaceId',
			'courses',
			'sessions',
			'observations',
			'decisions'
		]) ||
		parsed.format !== TEACHERFLOW_BACKUP_FORMAT ||
		parsed.formatVersion !== TEACHERFLOW_BACKUP_VERSION ||
		parsed.workspaceId !== 'personal' ||
		typeof parsed.appVersion !== 'string' ||
		!parsed.appVersion.trim() ||
		typeof parsed.exportedAt !== 'string'
	) {
		return { ok: false, reason: 'invalid' };
	}
	try {
		const snapshot = backupSnapshot(parsed);
		if (!snapshot) return { ok: false, reason: 'invalid' };
		validateWorkspaceSnapshot(snapshot);
		const exportedAt = new Date(parsed.exportedAt);
		if (Number.isNaN(exportedAt.getTime()) || exportedAt.toISOString() !== parsed.exportedAt) {
			return { ok: false, reason: 'invalid' };
		}
		return { ok: true, value: parsed as unknown as TeacherFlowBackup };
	} catch {
		return { ok: false, reason: 'invalid' };
	}
}
