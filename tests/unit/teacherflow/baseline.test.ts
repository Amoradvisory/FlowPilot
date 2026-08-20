import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('quality scripts', () => {
	it('exposes every Signature Edition gate', () => {
		for (const name of ['test:unit', 'test:integration', 'test:e2e', 'check', 'build:pages']) {
			expect(pkg.scripts).toHaveProperty(name);
		}
	});

	it('runs formatting through the shell-free quality runner', () => {
		const result = spawnSync(process.execPath, ['scripts/quality.mjs', 'lint'], {
			cwd: repositoryRoot,
			encoding: 'utf8'
		});

		expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
	}, 20_000);
});
