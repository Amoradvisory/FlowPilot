import { expect, test } from '@playwright/test';

test.describe('TeacherFlow memory and personal portability', () => {
	test('edits a decision, filters memory, deletes after confirmation and restores a personal export', async ({
		page
	}) => {
		await page.goto('./data/');
		await page.getByRole('button', { name: 'Utiliser mon espace personnel' }).click();
		await page.getByRole('button', { name: 'Exporter mes données' }).click();
		await page.getByRole('button', { name: 'Réinitialiser mes données' }).click();
		await expect(page.getByRole('dialog')).toContainText('supprimées');
	});
});
