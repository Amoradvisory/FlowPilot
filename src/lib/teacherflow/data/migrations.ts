import type { TeacherFlowDatabase } from './database';
import { MigrationFailed } from './errors';
import type { Course, Observation, Session, WorkspaceId } from '../domain/types';

export const LEGACY_MIGRATION_ID = 'legacy-localstorage-v1';
export const LEGACY_STORAGE_KEY = 'teacherflow-observations-v1';
export const MAX_RECOVERY_BACKUP_BYTES = 128 * 1024;

export interface StorageAdapter {
	getItem(key: string): string | null;
}

export interface MigrationResult {
	recovered: number;
	ignored: number;
	backupCreated: boolean;
	alreadyApplied: boolean;
}

export interface LegacyMigrationOptions {
	database: TeacherFlowDatabase;
	workspaceId: WorkspaceId;
	storage?: StorageAdapter;
	now?: () => Date;
	/** Test/SSR adapter seam: invoked inside the IndexedDB transaction before its commit. */
	beforeCommit?: () => void | Promise<void>;
}

type LegacyCandidate = {
	note?: unknown;
	text?: unknown;
	signal?: unknown;
	createdAt?: unknown;
	date?: unknown;
	timestamp?: unknown;
};

function currentStorage(): StorageAdapter | undefined {
	if (typeof globalThis.localStorage === 'undefined') return undefined;
	return globalThis.localStorage;
}

function bounded(raw: string): { raw: string; truncated: boolean } {
	if (raw.length <= MAX_RECOVERY_BACKUP_BYTES) return { raw, truncated: false };
	return { raw: raw.slice(0, MAX_RECOVERY_BACKUP_BYTES), truncated: true };
}

function recover(
	candidate: unknown,
	workspaceId: WorkspaceId,
	index: number,
	now: string
): Observation | undefined {
	if (!candidate || typeof candidate !== 'object') return undefined;
	const record = candidate as LegacyCandidate;
	const note =
		typeof record.note === 'string'
			? record.note.trim().replace(/\s+/gu, ' ')
			: typeof record.text === 'string'
				? record.text.trim().replace(/\s+/gu, ' ')
				: '';
	if (!note || note.length > 600) return undefined;
	const signal = record.signal;
	if (signal !== 'keep' && signal !== 'adjust' && signal !== 'verify') return undefined;
	const sourceDate = record.createdAt ?? record.date ?? record.timestamp ?? now;
	if (typeof sourceDate !== 'string' || Number.isNaN(Date.parse(sourceDate))) return undefined;
	const createdAt = new Date(sourceDate).toISOString();
	return {
		id: `legacy-observation-${index + 1}`,
		workspaceId,
		sessionId: `legacy-session-${index + 1}`,
		signal,
		note,
		createdAt,
		updatedAt: createdAt
	};
}

/**
 * Import is deliberately append-only: localStorage remains untouched even after success.
 * The metadata marker and all recovered entities are committed in the same transaction.
 */
export async function migrateLegacyLocalStorage({
	database,
	workspaceId,
	storage = currentStorage(),
	now = () => new Date(),
	beforeCommit
}: LegacyMigrationOptions): Promise<MigrationResult> {
	try {
		const raw = storage?.getItem(LEGACY_STORAGE_KEY) ?? null;
		const timestamp = now().toISOString();
		return await database.transaction(
			'rw',
			database.courses,
			database.sessions,
			database.observations,
			database.meta,
			database.recoveryBackups,
			async () => {
				const marker = await database.meta.get([workspaceId, LEGACY_MIGRATION_ID]);
				if (marker) return { recovered: 0, ignored: 0, backupCreated: false, alreadyApplied: true };

				if (raw === null) {
					await database.meta.put({
						workspaceId,
						key: LEGACY_MIGRATION_ID,
						value: { recovered: 0, ignored: 0 },
						updatedAt: timestamp
					});
					await beforeCommit?.();
					return { recovered: 0, ignored: 0, backupCreated: false, alreadyApplied: false };
				}

				const backup = bounded(raw);
				let records: unknown[] = [];
				let ignored = 0;
				try {
					const parsed: unknown = JSON.parse(raw);
					records = Array.isArray(parsed)
						? parsed
						: parsed &&
							  typeof parsed === 'object' &&
							  Array.isArray((parsed as { observations?: unknown }).observations)
							? (parsed as { observations: unknown[] }).observations
							: [];
					if (records.length === 0 && !Array.isArray(parsed)) ignored = 1;
				} catch {
					ignored = 1;
				}
				const observations = records.map((record, index) =>
					recover(record, workspaceId, index, timestamp)
				);
				const recovered = observations.filter((observation): observation is Observation =>
					Boolean(observation)
				);
				ignored += records.length - recovered.length;

				await database.recoveryBackups.add({
					workspaceId,
					migrationId: LEGACY_MIGRATION_ID,
					...backup,
					createdAt: timestamp
				});
				if (recovered.length > 0) {
					const course: Course = {
						id: 'legacy-import-course',
						workspaceId,
						name: 'Observations importées',
						colorToken: 'slate',
						createdAt: timestamp,
						updatedAt: timestamp
					};
					const sessions: Session[] = recovered.map((observation) => ({
						id: observation.sessionId,
						workspaceId,
						courseId: course.id,
						title: 'Observation importée',
						status: 'completed',
						createdAt: observation.createdAt,
						updatedAt: observation.updatedAt
					}));
					await database.courses.add(course);
					await database.sessions.bulkAdd(sessions);
					await database.observations.bulkAdd(recovered);
				}
				await database.meta.put({
					workspaceId,
					key: LEGACY_MIGRATION_ID,
					value: { recovered: recovered.length, ignored },
					updatedAt: timestamp
				});
				await beforeCommit?.();
				return { recovered: recovered.length, ignored, backupCreated: true, alreadyApplied: false };
			}
		);
	} catch (error) {
		throw new MigrationFailed(error);
	}
}
