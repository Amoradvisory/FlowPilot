import { DomainError, validateWorkspaceSnapshot } from '../domain/invariants';
import { planCourseDeletion, planObservationDeletion } from '../domain/commands';
import type {
	Course,
	Decision,
	EntityId,
	Observation,
	Session,
	WorkspaceId,
	WorkspaceSnapshot
} from '../domain/types';
import { TeacherFlowDatabase } from './database';
import { InvalidStoredData, mapStorageError } from './errors';
import {
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
	putObservationWithDecision(observation: Observation, decision?: Decision): Promise<void>;
	putDecision(decision: Decision): Promise<void>;
	deleteObservation(observationId: EntityId): Promise<void>;
	deleteCourse(courseId: EntityId): Promise<void>;
	replaceWorkspace(snapshot: WorkspaceSnapshot): Promise<void>;
	clearWorkspace(): Promise<void>;
}

export interface OpenTeacherFlowRepositoryOptions {
	/** Inject a database in tests or when an SSR host owns its lifecycle. */
	database?: TeacherFlowDatabase;
	databaseName?: string;
	/** Inject localStorage; SSR can omit it safely. */
	storage?: StorageAdapter;
	migrateLegacy?: boolean;
	now?: () => Date;
	migrationBeforeCommit?: LegacyMigrationOptions['beforeCommit'];
}

const empty = (workspaceId: WorkspaceId): WorkspaceSnapshot => ({
	workspaceId,
	courses: [],
	sessions: [],
	observations: [],
	decisions: []
});

function ordered<T extends { id: string }>(values: T[]): T[] {
	return values.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

class DexieTeacherFlowRepository implements TeacherFlowRepository {
	constructor(
		readonly workspaceId: WorkspaceId,
		private readonly database: TeacherFlowDatabase,
		readonly migration: MigrationResult
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
		await this.replaceEntity('courses', course);
	}

	async putSession(session: Session): Promise<void> {
		await this.replaceEntity('sessions', session);
	}

	async putDecision(decision: Decision): Promise<void> {
		await this.replaceEntity('decisions', decision);
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

	async clearWorkspace(): Promise<void> {
		await this.write(async () => this.removeWorkspace());
	}

	private async replaceEntity(
		table: 'courses' | 'sessions' | 'decisions',
		entity: Course | Session | Decision
	): Promise<void> {
		this.assertWorkspace(entity.workspaceId);
		await this.write(async (snapshot) => {
			const next: WorkspaceSnapshot = { ...snapshot, [table]: replace(snapshot[table], entity) };
			validateWorkspaceSnapshot(next);
			await this.database[table].put(entity as never);
		});
	}

	private async write(operation: (snapshot: WorkspaceSnapshot) => Promise<void>): Promise<void> {
		try {
			await this.database.transaction(
				'rw',
				this.database.courses,
				this.database.sessions,
				this.database.observations,
				this.database.decisions,
				async () => operation(await this.read())
			);
		} catch (error) {
			if (error instanceof DomainError) throw error;
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
	const database = options.database ?? new TeacherFlowDatabase(options.databaseName);
	try {
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
					beforeCommit: options.migrationBeforeCommit
				})
			: { recovered: 0, ignored: 0, backupCreated: false, alreadyApplied: false };
		return new DexieTeacherFlowRepository(workspaceId, database, migration);
	} catch (error) {
		throw mapStorageError(error);
	}
}
