import { spawn } from 'node:child_process';

const node = process.execPath;
const commands = {
	check: [
		[node, ['node_modules/@sveltejs/kit/svelte-kit.js', 'sync']],
		[node, ['node_modules/svelte-check/bin/svelte-check', '--tsconfig', './tsconfig.json']]
	],
	unit: [[node, ['node_modules/vitest/vitest.mjs', 'run', '--project', 'unit']]],
	integration: [[node, ['node_modules/vitest/vitest.mjs', 'run', '--project', 'integration']]],
	'build-pages': [[node, ['node_modules/vite/bin/vite.js', 'build'], { BASE_PATH: '/FlowPilot' }]]
};

function run(command, args, extraEnvironment = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, args, {
			env: { ...process.env, ...extraEnvironment },
			shell: false,
			stdio: 'inherit'
		});

		child.once('error', reject);
		child.once('close', (code, signal) => {
			const exitCode = code ?? 1;
			console.log(
				`quality: ${args.join(' ')} exited with ${exitCode}${signal ? ` (${signal})` : ''}`
			);
			resolve(exitCode);
		});
	});
}

async function main() {
	const name = process.argv[2];
	const steps = commands[name];

	if (!steps) {
		console.error(`Usage: node scripts/quality.mjs <${Object.keys(commands).join('|')}>`);
		process.exitCode = 2;
		return;
	}

	for (const [command, args, extraEnvironment] of steps) {
		const exitCode = await run(command, args, extraEnvironment);
		if (exitCode !== 0) {
			process.exitCode = exitCode;
			return;
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
