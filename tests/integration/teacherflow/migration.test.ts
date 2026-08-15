import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { openTeacherFlowRepository } from '../../../src/lib/teacherflow/data/repository';

const names: string[] = [];
function databaseName(): string {
	const name = `teacherflow-migration-${crypto.randomUUID()}`;
	names.push(name);
	return name;
}
function storageFor(value: string) {
	const values = new Map([['teacherflow-observations-v1', value]]);
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
		const raw = JSON.stringify([{ note: 'À conserver.', signal: 'keep' }]);
		const storage = storageFor(raw);
		await expect(
			openTeacherFlowRepository('personal', {
				databaseName: databaseName(),
				storage,
				migrationBeforeCommit: () => {
					throw new Error('forced transaction failure');
				}
			})
		).rejects.toMatchObject({ name: 'MigrationFailed' });
		expect(storage.getItem('teacherflow-observations-v1')).toBe(raw);
	});
});
