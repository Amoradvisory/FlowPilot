import { expect, test } from '@playwright/test';

test('publishes TeacherFlow without the legacy shell or unsupported PWA metadata', async ({
	page
}) => {
	await page.goto('./');

	await expect(page).toHaveTitle('Aujourd’hui · TeacherFlow');
	await expect(page.locator('body')).not.toContainText(/Nexus Notes|Neural notebook/u);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		'href',
		'https://amoradvisory.github.io/FlowPilot/teacher/'
	);
	await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
	await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveCount(0);
	await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveCount(0);

	const internalPaths = await page
		.locator('a[href]')
		.evaluateAll((links) =>
			links
				.map((link) => new URL((link as HTMLAnchorElement).href).pathname)
				.filter((pathname) => pathname.startsWith('/FlowPilot/'))
		);
	expect(internalPaths.length).toBeGreaterThan(0);
	expect(internalPaths.every((pathname) => pathname.startsWith('/FlowPilot/teacher/'))).toBe(true);
});

test('serves every public TeacherFlow route directly without console or HTTP errors', async ({
	page
}) => {
	const consoleErrors: string[] = [];
	const failedResponses: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	page.on('response', (response) => {
		if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
	});

	for (const route of ['', 'observe/', 'memory/', 'data/', 'about/']) {
		const response = await page.goto(`./${route}`);
		expect(response?.ok(), `${route || 'teacher/'} must return HTTP 2xx`).toBe(true);
		await expect(page.locator('body')).not.toContainText(/Nexus Notes|Neural notebook/u);
		await page.reload();
	}

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('./');
	const widths = await page.evaluate(() => ({
		client: document.documentElement.clientWidth,
		scroll: document.documentElement.scrollWidth
	}));
	expect(widths.scroll).toBeLessThanOrEqual(widths.client);
	expect(consoleErrors).toEqual([]);
	expect(failedResponses).toEqual([]);
});
