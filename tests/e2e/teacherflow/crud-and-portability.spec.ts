import { expect, test } from '@playwright/test';

test.describe('TeacherFlow CRUD and personal portability', () => {
	test('creates, edits, filters, deletes, exports, resets and restores a personal workspace', async ({
		page
	}) => {
		await page.goto('./data/');
		await page.getByRole('button', { name: 'Utiliser mon espace personnel' }).click();
		await page.goto('./');
		await page.getByLabel('Nom du cours').first().fill('Mathématiques appliquées');
		await page.getByLabel('Matière (facultatif)').first().fill('Algèbre');
		await page.getByRole('button', { name: 'Créer le cours' }).first().click();
		await expect(page.getByTestId('all-personal-context')).toContainText(
			'Mathématiques appliquées'
		);
		await page.getByLabel('Titre de la séance').last().fill('Fractions — diagnostic');
		await page.getByRole('button', { name: 'Créer la séance' }).last().click();
		await page.getByRole('link', { name: 'Ajouter une observation' }).click();
		await page.getByLabel('Observation').fill('Un exemple commun rend la consigne plus claire.');
		await page.getByLabel('Décision pédagogique').fill('Prévoir un exemple commun.');
		await page.getByRole('button', { name: 'Enregistrer la décision' }).click();
		await page.goto('./memory/');
		await page.getByRole('button', { name: 'Modifier' }).first().click();
		await page.getByLabel('Note').fill('Un exemple commun clarifie la consigne.');
		await page.getByLabel('Décision').fill('Préparer un exemple commun avant la consigne.');
		await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
		await page.getByRole('button', { name: 'Marquer prête' }).click();
		await page.getByRole('button', { name: 'Marquer appliquée' }).click();
		await page.getByLabel('État').selectOption('applied');
		await expect(page.getByText('Préparer un exemple commun avant la consigne.')).toBeVisible();
		await page.goto('./data/');
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Exporter mes données' }).click();
		const backup = await download;
		await page.getByRole('button', { name: 'Réinitialiser mes données' }).click();
		await page
			.getByRole('dialog')
			.getByLabel(/Écrivez/u)
			.fill('SUPPRIMER');
		await page
			.getByRole('dialog')
			.getByRole('button', { name: 'Supprimer définitivement' })
			.click();
		await expect(page.getByText('0 cours')).toBeVisible();
		await page.getByLabel('Fichier de sauvegarde TeacherFlow').setInputFiles(await backup.path());
		await expect(page.getByText('Aperçu avant remplacement')).toBeVisible();
		await page.getByRole('button', { name: 'Remplacer mon espace avec cette sauvegarde' }).click();
		await expect(page.getByText('1 cours')).toBeVisible();
	});
});
