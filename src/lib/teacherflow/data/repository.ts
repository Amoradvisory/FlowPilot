import { DomainError, validateWorkspaceSnapshot } from '../domain/invariants';
import {
	planCourseDeletion,
	planObservationDeletion,
	planSessionDeletion,
	updateDecisionStatus,
	updateDecisionText,
	updateObservation
} from '../domain/commands';
import type {
	Course,
	Decision,
	DecisionStatus,
	EntityId,
	Observation,
	ObservationDraft,
	Session,
	WorkspaceId,
	WorkspaceSnapshot
} from '../domain/types';
import { TeacherFlowDatabase } from './database';
import { BackupError, TEACHERFLOW_BACKUP_MAX_BYTES } from './backup';
import { InvalidStoredData, mapStorageError } from './errors';
import {
	LEGACY_SOURCES,
	migrateLegacyLocalStorage,
	type LegacyMigrationOptions,
	type MigrationResult,
	type StorageAdapter
} from './migrations';

export interface TeacherFlowRepository {
	readonly workspaceId: WorkspaceId;
	readonly migration: MigrationResult;
	load(): Promise<WorkspaceSnapshot>;
	putCourse(course: Course): Promise<void>;
	putSession(session: Session): Promise<void>;
	putObservation(observation: Observation): Promise<void>;
	editObservationWithDecision(
		input: ObservationDecisionEdit
	): Promise<ObservationDecisionEditResult>;
	advanceDecision(input: DecisionStatusAdvance): Promise<Decision>;
	putObservationWithDecision(observation: Observation, decision?: Decision): Promise<void>;
	putDecision(decision: Decision): Promise<void>;
	deleteObservation(observationId: EntityId): Promise<void>;
	deleteSession(sessionId: EntityId): Promise<void>;
	deleteCourse(courseId: EntityId): Promise<void>;
	replaceWorkspace(snapshot: WorkspaceSnapshot): Promise<void>;
	/** Validates first, then writes a recoverable pre-import copy and replacement in one transaction. */
	importPersonalWorkspace(snapshot: WorkspaceSnapshot, appVersion: string): Promise<void>;
	lastPersonalExportedAt(): Promise<string | undefined>;
	markPersonalExportedAt(exportedAt: string): Promise<void>;
	clearWorkspace(): Promise<void>;
	/** Atomically seeds only a new demo workspace; a durable marker makes this idempotent. */
	ensureDemoSeed(snapshot: WorkspaceSnapshot): Promise<void>;
}

export interface ObservationDecisionEdit {
	readonly observationId: EntityId;
	readonly expectedObservationUpdatedAt: string;
	readonly observation: ObservationDraft;
	readonly decision?: {
		readonly id: EntityId;
		readonly expectedUpdatedAt: string;
		readonly text: string;
	};
	readonly now: () => Date;
}

export interface ObservationDecisionEditResult {
	readonly observation: Observation;
	readonly decision?: Decision;
}

export interface DecisionStatusAdvance {
	readonly decisionId: EntityId;
	readonly expectedUpdatedAt: string;
	readonly nextStatus: DecisionStatus;
	readonly now: () => Date;
}

export interface OpenTeacherFlowRepositoryOptions {
	databaseName?: string;
	/** Optional platform port for SSR/tests; Dexie itself never crosses this API. */
	indexedDB?: IDBFactory | null;
	idbKeyRange?: typeof IDBKeyRange | null;
	/** Inject localStorage; SSR can omit it safely. */
	storage?: StorageAdapter;
	migrateLegacy?: boolean;
	now?: () => Date;
	migrationAfterFirstWrite?: LegacyMigrationOptions['afterFirstWrite'];
	afterLinkedWrite?: () => void | Promise<void>;
}

function ordered<T extends { id: string }>(values: T[]): T[] {
	return values.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

class DexieTeacherFlowRepository implements TeacherFlowRepository {
	constructor(
		readonly workspaceId: WorkspaceId,
		private readonly database: TeacherFlowDatabase,
		readonly migration: MigrationResult,
		private readonly afterLinkedWrite?: () => void | Promise<void>
	) {}

	async load(): Promise<WorkspaceSnapshot> {
		try {
			const snapshot = await this.read();
			try {
				return validateWorkspaceSnapshot(snapshot);
			} catch (error) {
				throw new InvalidStoredData(error);
			}
		} catch (error) {
			if (error instanceof InvalidStoredData) throw error;
			throw mapStorageError(error);
		}
	}

	async putCourse(course: Course): Promise<void> {
		await this.replaceEntity(['courses', course]);
	}

	async putSession(session: Session): Promise<void> {
		await this.replaceEntity(['sessions', session]);
	}

	async putObservation(observation: Observation): Promise<void> {
		this.assertWorkspace(observation.workspaceId);
		await this.write(async (snapshot) => {
			const next: WorkspaceSnapshot = {
				...snapshot,
				observations: replace(snapshot.observations, observation)
			};
			validateWorkspaceSnapshot(next);
			await this.database.observations.put(observation);
		});
	}

	async editObservationWithDecision(
		input: ObservationDecisionEdit
	): Promise<ObservationDecisionEditResult> {
		let result: ObservationDecisionEditResult | undefined;
		await this.write(async (snapshot) => {
			const currentObservation = snapshot.observations.find(({ id }) => id === input.observationId);
			if (
				!currentObservation ||
				currentObservation.updatedAt !== input.expectedObservationUpdatedAt
			) {
				throw new DomainError(
					'invalid_transition',
					'Observation has changed; reload before editing',
					'updatedAt'
				);
			}
			const observation = updateObservation(
				currentObservation,
				{ ...input.observation, workspaceId: this.workspaceId },
				input.now
			);
			let decision: Decision | undefined;
			if (input.decision) {
				const currentDecision = snapshot.decisions.find(({ id }) => id === input.decision!.id);
				if (
					!currentDecision ||
					currentDecision.observationId !== currentObservation.id ||
					currentDecision.updatedAt !== input.decision.expectedUpdatedAt
				) {
					throw new DomainError(
						'invalid_transition',
						'Decision has changed; reload before editing',
						'updatedAt'
					);
				}
				decision = updateDecisionText(currentDecision, input.decision.text, input.now);
			}
			const next: WorkspaceSnapshot = {
				...snapshot,
				observations: replace(snapshot.observations, observation),
				decisions: decision ? replace(snapshot.decisions, decision) : snapshot.decisions
			};
			validateWorkspaceSnapshot(next);
			await this.database.observations.put(observation);
			await this.afterLinkedWrite?.();
			if (decision) await this.database.decisions.put(decision);
			result = decision ? { observation, decision } : { observation };
		});
		return result!;
	}

	async advanceDecision(input: DecisionStatusAdvance): Promise<Decision> {
		let result: Decision | undefined;
		await this.write(async (snapshot) => {
			const current = snapshot.decisions.find(({ id }) => id === input.decisionId);
			if (!current || current.updatedAt !== input.expectedUpdatedAt) {
				throw new DomainError(
					'invalid_transition',
					'Decision has changed; reload before advancing',
					'updatedAt'
				);
			}
			const decision = updateDecisionStatus(current, input.nextStatus, input.now);
			const next: WorkspaceSnapshot = {
				...snapshot,
				decisions: replace(snapshot.decisions, decision)
			};
			validateWorkspaceSnapshot(next);
			await this.database.decisions.put(decision);
			result = decision;
		});
		return result!;
	}

	async putDecision(decision: Decision): Promise<void> {
		await this.replaceEntity(['decisions', decision]);
	}

	async putObservationWithDecision(observation: Observation, decision?: Decision): Promise<void> {
		if (decision && decision.observationId !== observation.id) {
			throw new DomainError(
				'relation_not_found',
				'Decision must belong to the supplied observation',
				'observationId'
			);
		}
		await this.write(async (snapshot) => {
			const next: WorkspaceSnapshot = {
				...snapshot,
				observations: replace(snapshot.observations, observation),
				decisions: decision ? replace(snapshot.decisions, decision) : snapshot.decisions
			};
			validateWorkspaceSnapshot(next);
			await this.database.observations.put(observation);
			await this.afterLinkedWrite?.();
			if (decision) await this.database.decisions.put(decision);
		});
	}

	async deleteObservation(observationId: EntityId): Promise<void> {
		await this.write(async (snapshot) => {
			const intent = planObservationDeletion(snapshot, observationId);
			await this.database.observations.bulkDelete(
				intent.delete.observationIds.map((id) => [this.workspaceId, id])
			);
			await this.database.decisions.bulkDelete(
				intent.delete.decisionIds.map((id) => [this.workspaceId, id])
			);
		});
	}

	async deleteSession(sessionId: EntityId): Promise<void> {
		await this.write(async (snapshot) => {
			const intent = planSessionDeletion(snapshot, sessionId);
			await this.database.sessions.bulkDelete(
				intent.delete.sessionIds.map((id) => [this.workspaceId, id])
			);
			await this.database.observations.bulkDelete(
				intent.delete.observationIds.map((id) => [this.workspaceId, id])
			);
			await this.database.decisions.bulkDelete(
				intent.delete.decisionIds.map((id) => [this.workspaceId, id])
			);
			for (const decisionId of intent.clearDecisionTargetIds) {
				const decision = snapshot.decisions.find(({ id }) => id === decisionId)!;
				const { targetSessionId: _targetSessionId, ...cleared } = decision;
				await this.database.decisions.put(cleared);
			}
		});
	}

	async deleteCourse(courseId: EntityId): Promise<void> {
		await this.write(async (snapshot) => {
			const intent = planCourseDeletion(snapshot, courseId);
			await this.database.courses.bulkDelete(
				intent.delete.courseIds.map((id) => [this.workspaceId, id])
			);
			await this.database.sessions.bulkDelete(
				intent.delete.sessionIds.map((id) => [this.workspaceId, id])
			);
			await this.database.observations.bulkDelete(
				intent.delete.observationIds.map((id) => [this.workspaceId, id])
			);
			await this.database.decisions.bulkDelete(
				intent.delete.decisionIds.map((id) => [this.workspaceId, id])
			);
			for (const decisionId of intent.clearDecisionTargetIds) {
				const decision = snapshot.decisions.find(({ id }) => id === decisionId)!;
				const { targetSessionId: _targetSessionId, ...cleared } = decision;
				await this.database.decisions.put(cleared);
			}
		});
	}

	async replaceWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
		this.assertWorkspace(snapshot.workspaceId);
		validateWorkspaceSnapshot(snapshot);
		await this.write(async () => {
			await this.removeWorkspace();
			await this.database.courses.bulkPut(snapshot.courses);
			await this.database.sessions.bulkPut(snapshot.sessions);
			await this.database.observations.bulkPut(snapshot.observations);
			await this.database.decisions.bulkPut(snapshot.decisions);
		});
	}

	async importPersonalWorkspace(snapshot: WorkspaceSnapshot, appVersion: string): Promise<void> {
		if (this.workspaceId !== 'personal' || snapshot.workspaceId !== 'personal') {
			throw new DomainError(
				'workspace_mismatch',
				'Only personal data can be imported',
				'workspaceId'
			);
		}
		validateWorkspaceSnapshot(snapshot);
		if (!appVersion.trim())
			throw new DomainError('required', 'appVersion is required', 'appVersion');
		await this.write(async (current) => {
			const raw = JSON.stringify(current);
			if (new TextEncoder().encode(raw).byteLength > TEACHERFLOW_BACKUP_MAX_BYTES) {
				throw new BackupError(
					'too_large',
					'La sauvegarde de récupération dépasse la taille maximale de 1 Mo.'
				);
			}
			const createdAt = new Date().toISOString();
			await this.database.recoveryBackups.add({
				workspaceId: this.workspaceId,
				migrationId: `pre-import-${createdAt}-${crypto.randomUUID()}`,
				raw,
				truncated: false,
				createdAt
			});
			await this.removeWorkspace();
			await this.database.courses.bulkPut(snapshot.courses);
			await this.database.sessions.bulkPut(snapshot.sessions);
			await this.database.observations.bulkPut(snapshot.observations);
			await this.database.decisions.bulkPut(snapshot.decisions);
		});
	}

	async lastPersonalExportedAt(): Promise<string | undefined> {
		if (this.workspaceId !== 'personal') return undefined;
		const record = await this.database.meta.get([this.workspaceId, 'last-personal-export']);
		return typeof record?.value === 'string' ? record.value : undefined;
	}

	async markPersonalExportedAt(exportedAt: string): Promise<void> {
		if (this.workspaceId !== 'personal') {
			throw new DomainError(
				'workspace_mismatch',
				'Only personal exports can be recorded',
				'workspaceId'
			);
		}
		const canonical = new Date(exportedAt).toISOString();
		if (canonical !== exportedAt)
			throw new DomainError('invalid_date', 'exportedAt must be a valid date', 'exportedAt');
		await this.write(async () => {
			await this.database.meta.put({
				workspaceId: this.workspaceId,
				key: 'last-personal-export',
				value: exportedAt,
				updatedAt: exportedAt
			});
		});
	}

	async clearWorkspace(): Promise<void> {
		await this.write(async () => {
			await this.removeWorkspace();
			await this.database.recoveryBackups.where('workspaceId').equals(this.workspaceId).delete();
			for (const source of LEGACY_SOURCES) {
				await this.database.meta.put({
					workspaceId: this.workspaceId,
					key: source.migrationId,
					value: { status: 'reset' },
					updatedAt: new Date().toISOString()
				});
			}
		});
	}

	async ensureDemoSeed(snapshot: WorkspaceSnapshot): Promise<void> {
		this.assertWorkspace(snapshot.workspaceId);
		if (this.workspaceId !== 'demo') {
			throw new DomainError(
				'workspace_mismatch',
				'Only the demo workspace can be seeded',
				'workspaceId'
			);
		}
		validateWorkspaceSnapshot(snapshot);
		await this.write(async (current) => {
			const marker = await this.database.meta.get([this.workspaceId, 'demo-seed-v1']);
			if (marker) return;
			if (
				current.courses.length === 0 &&
				current.sessions.length === 0 &&
				current.observations.length === 0 &&
				current.decisions.length === 0
			) {
				await this.database.courses.bulkPut(snapshot.courses);
				await this.database.sessions.bulkPut(snapshot.sessions);
				await this.database.observations.bulkPut(snapshot.observations);
				await this.database.decisions.bulkPut(snapshot.decisions);
			}
			await this.database.meta.put({
				workspaceId: this.workspaceId,
				key: 'demo-seed-v1',
				value: { initialized: true },
				updatedAt: snapshot.courses[0]!.updatedAt
			});
		});
	}

	private async replaceEntity(
		entry: ['courses', Course] | ['sessions', Session] | ['decisions', Decision]
	): Promise<void> {
		const entity = entry[1];
		this.assertWorkspace(entity.workspaceId);
		await this.write(async (snapshot) => {
			switch (entry[0]) {
				case 'courses': {
					const next: WorkspaceSnapshot = {
						...snapshot,
						courses: replace(snapshot.courses, entry[1])
					};
					validateWorkspaceSnapshot(next);
					await this.database.courses.put(entry[1]);
					return;
				}
				case 'sessions': {
					const next: WorkspaceSnapshot = {
						...snapshot,
						sessions: replace(snapshot.sessions, entry[1])
					};
					validateWorkspaceSnapshot(next);
					await this.database.sessions.put(entry[1]);
					return;
				}
				case 'decisions': {
					const next: WorkspaceSnapshot = {
						...snapshot,
						decisions: replace(snapshot.decisions, entry[1])
					};
					validateWorkspaceSnapshot(next);
					await this.database.decisions.put(entry[1]);
					return;
				}
			}
		});
	}

	private async write(operation: (snapshot: WorkspaceSnapshot) => Promise<void>): Promise<void> {
		try {
			await this.database.transaction(
				'rw',
				[
					this.database.courses,
					this.database.sessions,
					this.database.observations,
					this.database.decisions,
					this.database.meta,
					this.database.recoveryBackups
				],
				async () => operation(await this.read())
			);
		} catch (error) {
			if (error instanceof DomainError || error instanceof BackupError) throw error;
			throw mapStorageError(error);
		}
	}

	private async read(): Promise<WorkspaceSnapshot> {
		const [courses, sessions, observations, decisions] = await Promise.all([
			this.database.courses.where('workspaceId').equals(this.workspaceId).toArray(),
			this.database.sessions.where('workspaceId').equals(this.workspaceId).toArray(),
			this.database.observations.where('workspaceId').equals(this.workspaceId).toArray(),
			this.database.decisions.where('workspaceId').equals(this.workspaceId).toArray()
		]);
		return {
			workspaceId: this.workspaceId,
			courses: ordered(courses),
			sessions: ordered(sessions),
			observations: ordered(observations),
			decisions: ordered(decisions)
		};
	}

	private async removeWorkspace(): Promise<void> {
		await Promise.all([
			this.database.courses.where('workspaceId').equals(this.workspaceId).delete(),
			this.database.sessions.where('workspaceId').equals(this.workspaceId).delete(),
			this.database.observations.where('workspaceId').equals(this.workspaceId).delete(),
			this.database.decisions.where('workspaceId').equals(this.workspaceId).delete()
		]);
	}

	private assertWorkspace(workspaceId: WorkspaceId): void {
		if (workspaceId !== this.workspaceId) {
			throw new DomainError(
				'workspace_mismatch',
				'Entity belongs to another workspace',
				'workspaceId'
			);
		}
	}
}

function replace<T extends { id: string }>(values: readonly T[], entity: T): T[] {
	return [...values.filter(({ id }) => id !== entity.id), entity];
}

export async function openTeacherFlowRepository(
	workspaceId: WorkspaceId,
	options: OpenTeacherFlowRepositoryOptions = {}
): Promise<TeacherFlowRepository> {
	try {
		const indexedDB =
			options.indexedDB === null ? undefined : (options.indexedDB ?? globalThis.indexedDB);
		const idbKeyRange =
			options.idbKeyRange === null ? undefined : (options.idbKeyRange ?? globalThis.IDBKeyRange);
		if (!indexedDB || !idbKeyRange)
			throw Object.assign(new Error('IndexedDB unavailable'), { name: 'MissingAPIError' });
		const database = new TeacherFlowDatabase(options.databaseName, indexedDB, idbKeyRange);
		await database.open();
		const canMigrate =
			(options.migrateLegacy !== false &&
				workspaceId === 'personal' &&
				options.storage !== undefined) ||
			(options.migrateLegacy !== false &&
				workspaceId === 'personal' &&
				typeof globalThis.localStorage !== 'undefined');
		const migration = canMigrate
			? await migrateLegacyLocalStorage({
					database,
					workspaceId,
					storage: options.storage,
					now: options.now,
					afterFirstWrite: options.migrationAfterFirstWrite
				})
			: { recovered: 0, ignored: 0, backupCreated: false, alreadyApplied: false };
		return new DexieTeacherFlowRepository(
			workspaceId,
			database,
			migration,
			options.afterLinkedWrite
		);
	} catch (error) {
		throw mapStorageError(error);
	}
}
