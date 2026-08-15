import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { openTeacherFlowRepository } from '../../../src/lib/teacherflow/data/repository';
import { TeacherFlowDatabase } from '../../../src/lib/teacherflow/data/database';
import {
	MAX_RECOVERY_BACKUP_BYTES,
	PUBLIC_DEMO_MIGRATION_ID,
	PUBLIC_DEMO_STORAGE_KEY
} from '../../../src/lib/teacherflow/data/migrations';
import Dexie from 'dexie';

const names: string[] = [];
function databaseName(): string {
	const name = `teacherflow-migration-${crypto.randomUUID()}`;
	names.push(name);
	return name;
}
function storageFor(value: string, key = 'teacherflow-observations-v1') {
	const values = new Map([[key, value]]);
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, next: string) => values.set(key, next),
		removeItem: (key: string) => values.delete(key) ?? undefined
	};
}
afterEach(async () => {
	await Promise.all(names.splice(0).map((name) => indexedDB.deleteDatabase(name)));
});

describe('legacy localStorage migration', () => {
	it('upgrades the exact v1 recoveryBackups schema without changing its primary key', async () => {
		const name = databaseName();
		const v1 = new Dexie(name);
		v1.version(1).stores({
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
		await v1.open();
		await v1.table('recoveryBackups').add({
			workspaceId: 'personal',
			migrationId: PUBLIC_DEMO_MIGRATION_ID,
			raw: 'v1 backup',
			truncated: false,
			createdAt: '2026-08-15T09:00:00.000Z'
		});
		await v1.close();
		const database = new TeacherFlowDatabase(name);
		await database.open();
		expect(
			await database.recoveryBackups
				.where('[workspaceId+migrationId]')
				.equals(['personal', PUBLIC_DEMO_MIGRATION_ID])
				.first()
		).toMatchObject({ raw: 'v1 backup' });
		expect(database.recoveryBackups.schema.primKey.auto).toBe(true);
		expect(database.recoveryBackups.schema.idxByName['[workspaceId+migrationId]']?.unique).toBe(
			true
		);
		await database.close();
	});
	it('migrates the exact public-demo payload with explicit neutral-signal mapping and canonical capturedAt', async () => {
		const storage = storageFor(
			JSON.stringify([
				{
					id: 'one',
					signal: 'worked',
					note: 'Ça fonctionne.',
					capturedAt: '2026-08-15T11:00:00+02:00',
					nextAction: 'ignored'
				},
				{
					id: 'two',
					signal: 'blocked',
					note: 'La consigne bloque.',
					capturedAt: '2026-08-15T10:00:00.000Z',
					nextAction: 'ignored'
				},
				{
					id: 'three',
					signal: 'try',
					note: 'Tester une image.',
					capturedAt: '2026-08-15T10:30:00.000Z',
					nextAction: 'ignored'
				}
			]),
			PUBLIC_DEMO_STORAGE_KEY
		);
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: databaseName(),
			storage
		});
		expect(
			(await repo.load()).observations.map(({ signal, createdAt }) => ({ signal, createdAt }))
		).toEqual([
			{ signal: 'keep', createdAt: '2026-08-15T09:00:00.000Z' },
			{ signal: 'adjust', createdAt: '2026-08-15T10:00:00.000Z' },
			{ signal: 'verify', createdAt: '2026-08-15T10:30:00.000Z' }
		]);
	});

	it('backs up raw data, recovers valid records, counts ignored records, and is idempotent', async () => {
		const raw = JSON.stringify([
			{
				note: 'Faire verbaliser la stratégie.',
				signal: 'adjust',
				createdAt: '2026-08-15T09:00:00.000Z'
			},
			{ note: '', signal: 'keep' },
			{ note: 'Date cassée', signal: 'verify', createdAt: 'jamais' },
			42
		]);
		const storage = storageFor(raw);
		const repo = await openTeacherFlowRepository('personal', {
			databaseName: databaseName(),
			storage
		});
		expect(repo.migration).toMatchObject({ recovered: 1, ignored: 3, backupCreated: true });
		expect(await repo.load()).toMatchObject({
			courses: [{ name: 'Observations importées' }],
			observations: [{ note: 'Faire verbaliser la stratégie.' }]
		});
		expect(storage.getItem('teacherflow-observations-v1')).toBe(raw);
		const reopened = await openTeacherFlowRepository('personal', {
			databaseName: names[0],
			storage
		});
		expect(reopened.migration).toMatchObject({ recovered: 0, ignored: 0, alreadyApplied: true });
	});

	it('does not alter the source when migration storage fails', async () => {
		const raw = JSON.stringify([
			{ note: 'À conserver.', signal: 'keep', createdAt: '2026-08-15T09:00:00.000Z' }
		]);
		const storage = storageFor(raw);
		await expect(
			openTeacherFlowRepository('personal', {
				databaseName: databaseName(),
				storage,
				migrationAfterFirstWrite: () => {
					throw new Error('forced transaction failure');
				}
			})
		).rejects.toMatchObject({ name: 'MigrationFailed' });
		expect(storage.getItem('teacherflow-observations-v1')).toBe(raw);
	});

	it('keeps one durable byte-bounded backup after recovery rolls back, then retries without duplicates', async () => {
		const name = databaseName();
		const raw = JSON.stringify([
			{
				id: 'live',
				signal: 'worked',
				note: 'Note valide.',
				capturedAt: '2026-08-15T09:00:00.000Z'
			},
			{
				id: 'oversized',
				signal: 'try',
				note: 'é'.repeat(80_000),
				capturedAt: '2026-08-15T09:00:00.000Z'
			}
		]);
		const storage = storageFor(raw, PUBLIC_DEMO_STORAGE_KEY);
		await expect(
			openTeacherFlowRepository('personal', {
				databaseName: name,
				storage,
				migrationAfterFirstWrite: () => {
					throw new Error('abort after first write');
				}
			})
		).rejects.toMatchObject({ name: 'MigrationFailed' });
		const database = new TeacherFlowDatabase(name);
		await database.open();
		const backup = await database.recoveryBackups
			.where('[workspaceId+migrationId]')
			.equals(['personal', PUBLIC_DEMO_MIGRATION_ID])
			.first();
		expect(new TextEncoder().encode(backup?.raw).byteLength).toBeLessThanOrEqual(
			MAX_RECOVERY_BACKUP_BYTES
		);
		expect(backup?.truncated).toBe(true);
		expect(await database.meta.get(['personal', PUBLIC_DEMO_MIGRATION_ID])).toBeUndefined();
		expect(await database.observations.count()).toBe(0);
		await database.close();
		const recovered = await openTeacherFlowRepository('personal', { databaseName: name, storage });
		expect(recovered.migration).toMatchObject({ recovered: 1, backupCreated: false });
		expect((await recovered.load()).observations).toHaveLength(1);
	});

	it('backs up malformed JSON but reports invalid stored data without a success marker', async () => {
		const name = databaseName();
		const storage = storageFor('{not json', PUBLIC_DEMO_STORAGE_KEY);
		await expect(
			openTeacherFlowRepository('personal', { databaseName: name, storage })
		).rejects.toMatchObject({ name: 'InvalidStoredData' });
		const database = new TeacherFlowDatabase(name);
		await database.open();
		expect(
			await database.recoveryBackups
				.where('[workspaceId+migrationId]')
				.equals(['personal', PUBLIC_DEMO_MIGRATION_ID])
				.first()
		).toMatchObject({ raw: '{not json' });
		expect(await database.meta.get(['personal', PUBLIC_DEMO_MIGRATION_ID])).toBeUndefined();
		await database.close();
	});

	it('maps protected localStorage and missing IndexedDB without turning them into a migration failure', async () => {
		const security = Object.assign(new Error('blocked'), { name: 'SecurityError' });
		await expect(
			openTeacherFlowRepository('personal', {
				databaseName: databaseName(),
				storage: {
					getItem: () => {
						throw security;
					}
				}
			})
		).rejects.toMatchObject({ name: 'StorageUnavailable' });
		await expect(
			openTeacherFlowRepository('personal', { databaseName: databaseName(), indexedDB: null })
		).rejects.toMatchObject({ name: 'StorageUnavailable' });
	});

	it('works with an injected complete IndexedDB port and refuses an incomplete one', async () => {
		const name = databaseName();
		const repository = await openTeacherFlowRepository('personal', {
			databaseName: name,
			migrateLegacy: false,
			indexedDB,
			idbKeyRange: IDBKeyRange
		});
		expect(await repository.load()).toEqual({
			workspaceId: 'personal',
			courses: [],
			sessions: [],
			observations: [],
			decisions: []
		});
		await expect(
			openTeacherFlowRepository('personal', {
				databaseName: databaseName(),
				migrateLegacy: false,
				indexedDB,
				idbKeyRange: null
			})
		).rejects.toMatchObject({ name: 'StorageUnavailable' });
	});

	it('maps quota exhaustion during recovery to StorageFull', async () => {
		const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
		const storage = storageFor(
			JSON.stringify([
				{
					id: 'quota',
					signal: 'worked',
					note: 'Note valide.',
					capturedAt: '2026-08-15T09:00:00.000Z'
				}
			]),
			PUBLIC_DEMO_STORAGE_KEY
		);
		await expect(
			openTeacherFlowRepository('personal', {
				databaseName: databaseName(),
				storage,
				migrationAfterFirstWrite: () => {
					throw quota;
				}
			})
		).rejects.toMatchObject({ name: 'StorageFull' });
	});
});
