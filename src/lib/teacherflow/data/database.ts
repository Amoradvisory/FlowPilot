import Dexie, { type Table } from 'dexie';
import type { Course, Decision, Observation, Session, WorkspaceId } from '../domain/types';

export interface MetaRecord {
	workspaceId: WorkspaceId;
	key: string;
	value: unknown;
	updatedAt: string;
}

export interface RecoveryBackup {
	id?: number;
	workspaceId: WorkspaceId;
	migrationId: string;
	raw: string;
	truncated: boolean;
	createdAt: string;
}

/** A narrow Dexie adapter. Repositories own all reads/writes and UI never receives tables. */
export class TeacherFlowDatabase extends Dexie {
	courses!: Table<Course, [string, string]>;
	sessions!: Table<Session, [string, string]>;
	observations!: Table<Observation, [string, string]>;
	decisions!: Table<Decision, [string, string]>;
	meta!: Table<MetaRecord, [string, string]>;
	recoveryBackups!: Table<RecoveryBackup, number>;

	constructor(name = 'teacherflow', indexedDB?: IDBFactory, idbKeyRange?: typeof IDBKeyRange) {
		super(name, indexedDB && idbKeyRange ? { indexedDB, IDBKeyRange: idbKeyRange } : undefined);
		this.version(1).stores({
			courses: '[workspaceId+id], workspaceId, id, [workspaceId+updatedAt]',
			sessions:
				'[workspaceId+id], workspaceId, id, [workspaceId+courseId], [workspaceId+scheduledFor], [workspaceId+updatedAt]',
			observations:
				'[workspaceId+id], workspaceId, id, [workspaceId+sessionId], [workspaceId+createdAt], [workspaceId+updatedAt]',
			decisions:
				'[workspaceId+id], workspaceId, id, [workspaceId+observationId], [workspaceId+targetSessionId], [workspaceId+status], [workspaceId+updatedAt]',
			meta: '[workspaceId+key], workspaceId, key',
			recoveryBackups: '++id, workspaceId, migrationId, [workspaceId+migrationId], createdAt'
		});
		this.version(2).stores({
			courses: '[workspaceId+id], workspaceId, id, [workspaceId+updatedAt]',
			sessions:
				'[workspaceId+id], workspaceId, id, [workspaceId+courseId], [workspaceId+scheduledFor], [workspaceId+updatedAt]',
			observations:
				'[workspaceId+id], workspaceId, id, [workspaceId+sessionId], [workspaceId+createdAt], [workspaceId+updatedAt]',
			decisions:
				'[workspaceId+id], workspaceId, id, [workspaceId+observationId], [workspaceId+targetSessionId], [workspaceId+status], [workspaceId+updatedAt]',
			meta: '[workspaceId+key], workspaceId, key',
			recoveryBackups: '++id, workspaceId, migrationId, &[workspaceId+migrationId], createdAt'
		});
	}
}
