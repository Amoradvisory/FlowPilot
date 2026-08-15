import { expect, test } from '@playwright/test';

test('TeacherFlow never renders the legacy shell', async ({ page }) => {
	await page.goto('./');
	await expect(page.locator('.teacherflow-app')).toHaveCount(1);
	await expect(page.locator('.shell-grid')).toHaveCount(0);
	await expect(page.getByText(/Nexus|Neural Notebook|Nouvelle note/i)).toHaveCount(0);
});
