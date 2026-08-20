import { expect, test } from '@playwright/test';

async function expectUniqueIds(page: import('@playwright/test').Page) {
	const duplicates = await page.locator('[id]').evaluateAll((elements) => {
		const ids = elements.map(({ id }) => id);
		return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
	});
	expect(duplicates).toEqual([]);
}

test('restores the essential local loop from its exported backup', async ({ page }) => {
	const courseName = 'Mathématiques appliquées';
	const sessionTitle = 'Fractions — diagnostic';
	const observation = 'Un exemple commun rend la consigne plus claire.';
	const decision = 'Prévoir un exemple commun avant la consigne.';

	await page.goto('./data/');
	await page.getByRole('button', { name: 'Utiliser mon espace personnel' }).click();
	await expect(page.getByText('Espace personnel', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Aujourd’hui', exact: true }).click();

	const courseForm = page.locator('form[aria-labelledby="course-form-title-new"]');
	await courseForm.getByLabel('Nom du cours').fill(courseName);
	await courseForm.getByLabel('Matière (facultatif)').fill('Algèbre');
	await courseForm.getByRole('button', { name: 'Créer le cours' }).click();
	await expect(page.getByTestId('all-personal-context')).toContainText(courseName);

	const sessionForm = page.locator('form[aria-labelledby^="session-form-title-new-"]');
	await sessionForm.getByLabel('Titre de la séance').fill(sessionTitle);
	await sessionForm.getByRole('button', { name: 'Créer la séance' }).click();
	await expect(page.getByTestId('all-personal-context')).toContainText(sessionTitle);
	await expectUniqueIds(page);

	await page.getByRole('link', { name: 'Ajouter une observation', exact: true }).click();
	const observationForm = page.getByTestId('observe-form');
	await observationForm.getByLabel('Signal : À ajuster').check();
	await observationForm.getByLabel('Observation').fill(observation);
	await observationForm.getByLabel('Décision pédagogique').fill(decision);
	await observationForm.getByRole('button', { name: 'Enregistrer la décision' }).click();
	await expect(page.getByTestId('saved-decision')).toContainText(decision);

	await page.getByRole('link', { name: 'Mémoire', exact: true }).click();
	const memoryEntry = page.locator('.memory-entry').filter({ hasText: observation });
	await expect(memoryEntry).toContainText(decision);

	await page.getByRole('link', { name: 'Données', exact: true }).click();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Exporter mes données' }).click();
	const backup = await downloadPromise;
	await expect(page.getByText(/Dernier export :/u)).toContainText(
		'Aucune modification depuis cet export.'
	);

	await page.getByRole('button', { name: 'Réinitialiser mes données' }).click();
	const resetDialog = page.getByRole('dialog');
	await expect(resetDialog).toContainText('1 cours, 1 séance, 1 observation, 1 décision');
	await resetDialog.getByLabel(/Écrivez/u).fill('SUPPRIMER');
	await resetDialog.getByRole('button', { name: 'Supprimer définitivement' }).click();
	await expect(page.getByRole('button', { name: 'Réinitialiser mes données' })).toBeFocused();
	const exportSection = page
		.getByRole('heading', { name: 'Sauvegarder votre espace personnel' })
		.locator('..');
	await expect(exportSection).toContainText('0 cours · 0 séances · 0 observations · 0 décisions');
	await expect(page.getByText(/Dernier export :/u)).toContainText(
		'Des modifications existent depuis cet export.'
	);

	await page.getByLabel('Fichier de sauvegarde TeacherFlow').setInputFiles(await backup.path());
	const preview = page.getByRole('heading', { name: 'Aperçu avant remplacement' }).locator('..');
	await expect(preview).toContainText('1 cours · 1 séance · 1 observation · 1 décision');
	await preview.getByRole('button', { name: 'Remplacer mon espace avec cette sauvegarde' }).click();
	await expect(page.locator('.data-page > .status-message')).toHaveText('Enregistré localement');
	await expect(exportSection).toContainText('1 cours · 1 séance · 1 observation · 1 décision');
	await expect(page.getByText(/Dernier export :/u)).toContainText(
		'Des modifications existent depuis cet export.'
	);

	await page.getByRole('link', { name: 'Mémoire', exact: true }).click();
	await expect(page.locator('.memory-entry').filter({ hasText: observation })).toContainText(
		decision
	);
});
