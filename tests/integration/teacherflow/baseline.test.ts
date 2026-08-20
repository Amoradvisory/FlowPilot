import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';

describe('integration baseline', () => {
	it('keeps the integration runner available before repository tests exist', () => {
		expect(pkg.scripts['test:integration']).toBe('node scripts/quality.mjs integration');
	});
});
