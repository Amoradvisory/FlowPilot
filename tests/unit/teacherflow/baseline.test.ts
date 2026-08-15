import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';

describe('quality scripts', () => {
	it('exposes every Signature Edition gate', () => {
		for (const name of ['test:unit', 'test:integration', 'test:e2e', 'check', 'build:pages']) {
			expect(pkg.scripts).toHaveProperty(name);
		}
	});
});
