import type { TeacherFlowDatabase } from './database';
import {
	InvalidStoredData,
	mapStorageError,
	MigrationFailed,
	TeacherFlowStorageError
} from './errors';
import type { Course, Observation, Session, WorkspaceId } from '../domain/types';

export const LEGACY_STORAGE_KEY = 'teacherflow-observations-v1';
export const PUBLIC_DEMO_STORAGE_KEY = 'teacherflow-public-demo-observations-v1';
export const LEGACY_MIGRATION_ID = 'legacy-localstorage-v1';
export const PUBLIC_DEMO_MIGRATION_ID = 'legacy-localstorage-public-demo-v1';
export const MAX_RECOVERY_BACKUP_BYTES = 128 * 1024;

export const LEGACY_SOURCES = [
	{ key: PUBLIC_DEMO_STORAGE_KEY, migrationId: PUBLIC_DEMO_MIGRATION_ID, kind: 'public-demo' },
	{ key: LEGACY_STORAGE_KEY, migrationId: LEGACY_MIGRATION_ID, kind: 'plan' }
] as const;

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
	/** Test/host seam, invoked after first recovery write but before the success marker. */
	afterFirstWrite?: () => void | Promise<void>;
}

type LegacySource = (typeof LEGACY_SOURCES)[number];
type LegacyCandidate = Record<string, unknown>;

function defaultStorage(): StorageAdapter | undefined {
	return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
}

function timestamp(now: () => Date): string {
	const value = now();
	if (Number.isNaN(value.getTime()))
		throw new InvalidStoredData(new Error('Invalid migration clock'));
	return value.toISOString();
}

/** Keeps whole Unicode code points and never exceeds the byte, not UTF-16-unit, cap. */
export function boundedRawBackup(raw: string): { raw: string; truncated: boolean } {
	const encoder = new TextEncoder();
	if (encoder.encode(raw).byteLength <= MAX_RECOVERY_BACKUP_BYTES) return { raw, truncated: false };
	let result = '';
	let bytes = 0;
	for (const character of raw) {
		const size = encoder.encode(character).byteLength;
		if (bytes + size > MAX_RECOVERY_BACKUP_BYTES) break;
		result += character;
		bytes += size;
	}
	return { raw: result, truncated: true };
}

function parseRecords(raw: string): unknown[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		throw new InvalidStoredData(error);
	}
	if (Array.isArray(parsed)) return parsed;
	if (
		parsed &&
		typeof parsed === 'object' &&
		Array.isArray((parsed as { observations?: unknown }).observations)
	) {
		return (parsed as { observations: unknown[] }).observations;
	}
	throw new InvalidStoredData(new Error('Unsupported legacy schema'));
}

function noteOf(record: LegacyCandidate): string | undefined {
	const raw =
		typeof record.note === 'string'
			? record.note
			: typeof record.text === 'string'
				? record.text
				: undefined;
	if (!raw) return undefined;
	const note = raw.trim().replace(/\s+/gu, ' ');
	return note && note.length <= 600 ? note : undefined;
}

function dateOf(record: LegacyCandidate, source: LegacySource): string | undefined {
	const raw =
		source.kind === 'public-demo'
			? record.capturedAt
			: (record.createdAt ?? record.date ?? record.timestamp);
	if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) return undefined;
	return new Date(raw).toISOString();
}

function signalOf(
	record: LegacyCandidate,
	source: LegacySource
): Observation['signal'] | undefined {
	if (source.kind === 'public-demo') {
		// Legacy UI vocabulary is translated without ranking it: worked→keep, blocked→adjust, try→verify.
		return record.signal === 'worked'
			? 'keep'
			: record.signal === 'blocked'
				? 'adjust'
				: record.signal === 'try'
					? 'verify'
					: undefined;
	}
	return record.signal === 'keep' || record.signal === 'adjust' || record.signal === 'verify'
		? record.signal
		: undefined;
}

function recover(
	record: unknown,
	source: LegacySource,
	workspaceId: WorkspaceId,
	index: number
): Observation | undefined {
	if (!record || typeof record !== 'object') return undefined;
	const candidate = record as LegacyCandidate;
	const note = noteOf(candidate);
	const createdAt = dateOf(candidate, source);
	const signal = signalOf(candidate, source);
	if (!note || !createdAt || !signal) return undefined;
	return {
		id: `${source.migrationId}-observation-${index + 1}`,
		workspaceId,
		sessionId: `${source.migrationId}-session-${index + 1}`,
		signal,
		note,
		createdAt,
		updatedAt: createdAt
	};
}

async function ensureBackup(
	database: TeacherFlowDatabase,
	workspaceId: WorkspaceId,
	source: LegacySource,
	raw: string,
	createdAt: string
): Promise<boolean> {
	return database.transaction('rw', database.recoveryBackups, async () => {
		if (
			await database.recoveryBackups
				.where('[workspaceId+migrationId]')
				.equals([workspaceId, source.migrationId])
				.first()
		)
			return false;
		await database.recoveryBackups.add({
			workspaceId,
			migrationId: source.migrationId,
			...boundedRawBackup(raw),
			createdAt
		});
		return true;
	});
}

async function migrateSource(
	database: TeacherFlowDatabase,
	workspaceId: WorkspaceId,
	source: LegacySource,
	raw: string,
	createdAt: string,
	afterFirstWrite?: () => void | Promise<void>
): Promise<MigrationResult> {
	const existing = await database.meta.get([workspaceId, source.migrationId]);
	if (existing) return { recovered: 0, ignored: 0, backupCreated: false, alreadyApplied: true };
	const backupCreated = await ensureBackup(database, workspaceId, source, raw, createdAt);
	const records = parseRecords(raw);
	const recovered = records
		.map((record, index) => recover(record, source, workspaceId, index))
		.filter((value): value is Observation => Boolean(value));
	const ignored = records.length - recovered.length;
	try {
		return await database.transaction(
			'rw',
			database.courses,
			database.sessions,
			database.observations,
			database.meta,
			async () => {
				if (await database.meta.get([workspaceId, source.migrationId]))
					return { recovered: 0, ignored: 0, backupCreated: false, alreadyApplied: true };
				if (recovered.length > 0) {
					const courseId = `${source.migrationId}-course`;
					const course: Course = {
						id: courseId,
						workspaceId,
						name: 'Observations importées',
						colorToken: 'slate',
						createdAt,
						updatedAt: createdAt
					};
					const sessions: Session[] = recovered.map((observation) => ({
						id: observation.sessionId,
						workspaceId,
						courseId,
						title: 'Observation importée',
						status: 'completed',
						createdAt: observation.createdAt,
						updatedAt: observation.updatedAt
					}));
					await database.courses.put(course);
					await afterFirstWrite?.();
					await database.sessions.bulkPut(sessions);
					await database.observations.bulkPut(recovered);
				}
				await database.meta.put({
					workspaceId,
					key: source.migrationId,
					value: { status: 'imported', recovered: recovered.length, ignored },
					updatedAt: createdAt
				});
				return { recovered: recovered.length, ignored, backupCreated, alreadyApplied: false };
			}
		);
	} catch (error) {
		if (error instanceof InvalidStoredData) throw error;
		const mapped = mapStorageError(error);
		if (mapped instanceof TeacherFlowStorageError) throw mapped;
		throw new MigrationFailed(error);
	}
}

/** Migrate each independently versioned legacy source; source keys are never deleted. */
export async function migrateLegacyLocalStorage({
	database,
	workspaceId,
	storage = defaultStorage(),
	now = () => new Date(),
	afterFirstWrite
}: LegacyMigrationOptions): Promise<MigrationResult> {
	if (!storage) return { recovered: 0, ignored: 0, backupCreated: false, alreadyApplied: false };
	let total: MigrationResult = {
		recovered: 0,
		ignored: 0,
		backupCreated: false,
		alreadyApplied: true
	};
	for (const source of LEGACY_SOURCES) {
		let raw: string | null;
		try {
			raw = storage.getItem(source.key);
		} catch (error) {
			throw mapStorageError(error);
		}
		if (raw === null) continue;
		const result = await migrateSource(
			database,
			workspaceId,
			source,
			raw,
			timestamp(now),
			afterFirstWrite
		);
		total = {
			recovered: total.recovered + result.recovered,
			ignored: total.ignored + result.ignored,
			backupCreated: total.backupCreated || result.backupCreated,
			alreadyApplied: total.alreadyApplied && result.alreadyApplied
		};
	}
	return total;
}
