import { expect, test } from '@playwright/test';

test.describe('TeacherFlow core value loop', () => {
	test('explains the useful action in 30 seconds on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('./');

		await expect(
			page.getByText(
				'TeacherFlow transforme ce que vous remarquez après un cours en décision utile pour la prochaine séance.'
			)
		).toBeVisible();
		await expect(page.getByText('Données de démonstration', { exact: true })).toBeVisible();
		const nextSession = page.getByTestId('today-next-session');
		await expect(nextSession).toContainText('Préparer une stratégie de comparaison');
		const nextSessionBox = await nextSession.boundingBox();
		expect(nextSessionBox).not.toBeNull();
		expect(nextSessionBox!.y).toBeLessThan(844);

		const primaryCta = page.getByTestId('primary-value-loop-cta');
		await expect(primaryCta).toHaveCount(1);
		await expect(primaryCta).toHaveText('Vivre la boucle en 90 secondes');
		const box = await primaryCta.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.y + box!.height).toBeLessThanOrEqual(844);
		await expect(page.getByRole('link', { name: 'Ajouter une observation' })).toBeVisible();
		await page.screenshot({
			path: '.superpowers/sdd/2026-08-15-teacherflow-signature-edition/task-6-mobile-today.png'
		});
	});

	test('turns a human observation into an exact decision for a future session', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1440, height: 1000 });
		await page.goto('./');
		await page.getByTestId('primary-value-loop-cta').click();

		const form = page.getByTestId('observe-form');
		await expect(form).toBeVisible();
		await form.getByLabel('Signal : À ajuster').check();
		await form
			.getByLabel('Observation')
			.fill('La consigne est comprise quand un exemple commun est montré avant le travail.');
		const exactDecision = 'Montrer un exemple commun avant de distribuer la prochaine consigne.';
		await form.getByLabel('Décision pédagogique').fill(exactDecision);
		await form
			.getByLabel('Séance cible (facultatif)')
			.selectOption({ label: 'Préparer une stratégie de comparaison' });
		await form.getByRole('button', { name: 'Enregistrer la décision' }).click();

		const saved = page.getByTestId('saved-decision');
		await expect(saved).toBeFocused();
		await expect(saved).toContainText(exactDecision);
		await page.screenshot({
			path: '.superpowers/sdd/2026-08-15-teacherflow-signature-edition/task-6-desktop-saved.png'
		});
		await saved.getByRole('link', { name: 'Revenir à Aujourd’hui' }).click();
		await expect(page).toHaveURL(/\/FlowPilot\/teacher\/$/u);
		await expect(page.getByText(exactDecision, { exact: true })).toBeVisible();
	});

	test('keeps radio focus visible and the saved mobile decision fully in view', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('./observe/');
		const form = page.getByTestId('observe-form');
		await expect(form).toBeVisible();

		const keep = form.getByLabel('Signal : À conserver');
		const adjust = form.getByLabel('Signal : À ajuster');
		const verify = form.getByLabel('Signal : À vérifier');
		await keep.focus();
		for (const radio of [keep, adjust, verify]) {
			await expect(radio).toBeFocused();
			const outline = await radio.locator('..').evaluate((label) => {
				const style = getComputedStyle(label);
				return { style: style.outlineStyle, width: style.outlineWidth };
			});
			expect(outline).toEqual({ style: 'solid', width: '3px' });
			if (radio !== verify) await page.keyboard.press('ArrowRight');
		}

		await form
			.getByLabel('Observation')
			.fill('Un exemple commun rend la consigne plus facile à comparer.');
		const exactDecision = 'Afficher un exemple commun avant la prochaine consigne mobile.';
		await form.getByLabel('Décision pédagogique').fill(exactDecision);
		await form
			.getByLabel('Séance cible (facultatif)')
			.selectOption({ label: 'Préparer une stratégie de comparaison' });
		await form.getByRole('button', { name: 'Enregistrer la décision' }).click();

		const saved = page.getByTestId('saved-decision');
		await expect(saved).toBeFocused();
		await expect(saved).toContainText(exactDecision);
		const savedBox = await saved.boundingBox();
		expect(savedBox).not.toBeNull();
		expect(savedBox!.y).toBeGreaterThanOrEqual(0);
		expect(savedBox!.y + savedBox!.height).toBeLessThanOrEqual(844);
		await page.screenshot({
			path: '.superpowers/sdd/2026-08-15-teacherflow-signature-edition/task-6-mobile-saved.png'
		});
		await saved.getByRole('link', { name: 'Revenir à Aujourd’hui' }).click();
		await expect(page.getByText(exactDecision, { exact: true })).toBeVisible();
	});
});
