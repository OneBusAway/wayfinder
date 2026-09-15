import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * `scripts/validate-env.js` is top-level code that ends in `process.exit`, so it
 * is exercised by running it. It already takes an env file path as argv[2].
 * Vitest's `include` only covers `src/`, so this test lives here rather than
 * beside the script.
 */
const root = resolve(__dirname, '../../..');
const script = join(root, 'scripts/validate-env.js');

let dir;

beforeAll(() => {
	dir = mkdtempSync(join(tmpdir(), 'validate-env-'));
});

afterAll(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** Runs the validator against `contents`, returning its output and exit code. */
function validate(contents) {
	const envPath = join(dir, `${Math.random().toString(36).slice(2)}.env`);
	writeFileSync(envPath, contents);
	try {
		return { code: 0, output: execFileSync('node', [script, envPath], { encoding: 'utf-8' }) };
	} catch (err) {
		return { code: err.status, output: err.stdout ?? '' };
	}
}

// Derived from .env.example, minus every Sidecar line, so each test can vary
// the Sidecar config alone without hand-maintaining the list of required vars.
const BASE =
	readFileSync(join(root, '.env.example'), 'utf-8')
		.split('\n')
		.filter((line) => !/^\s*(PRIVATE_SIDECAR_|PRIVATE_OBACO_|PRIVATE_REGION_ID)/.test(line))
		.join('\n') + '\n';

describe('validate-env deprecated aliases', () => {
	it('accepts a deprecated name and asks for the rename', () => {
		const { code, output } = validate(
			`${BASE}PRIVATE_OBACO_API_BASE_URL=https://onebusaway.co/api/v1\nPRIVATE_REGION_ID=7\n`
		);

		expect(code).toBe(0);
		expect(output).toContain('PRIVATE_OBACO_API_BASE_URL: deprecated, rename to');
	});

	it('does not report a deprecated name as unknown', () => {
		const { output } = validate(`${BASE}PRIVATE_OBACO_API_BASE_URL=https://onebusaway.co/api/v1\n`);

		expect(output).not.toContain('not defined in env-schema.json');
	});

	it('says a deprecated name is ignored when its replacement is set', () => {
		const { output } = validate(
			`${BASE}PRIVATE_SIDECAR_API_BASE_URL=https://sidecar.onebusaway.org/api/v1\n` +
				`PRIVATE_SIDECAR_REGION_ID=3\nPRIVATE_OBACO_API_BASE_URL=https://onebusaway.co/api/v1\n`
		);

		expect(output).toContain('deprecated and ignored');
	});

	it('does not fail the build on a superseded alias holding a bad value', () => {
		const { code, output } = validate(
			`${BASE}PRIVATE_SIDECAR_API_BASE_URL=https://sidecar.onebusaway.org/api/v1\n` +
				`PRIVATE_SIDECAR_REGION_ID=3\nPRIVATE_OBACO_API_BASE_URL=notaurl\n`
		);

		expect(code).toBe(0);
		expect(output).not.toContain('invalid URL');
	});

	it('still validates a deprecated name that is the one taking effect', () => {
		const { code, output } = validate(
			`${BASE}PRIVATE_OBACO_API_BASE_URL=notaurl\nPRIVATE_REGION_ID=7\n`
		);

		expect(code).toBe(1);
		expect(output).toContain('invalid URL');
	});

	it('stays quiet about a deprecated name that is present but empty', () => {
		const { output } = validate(`${BASE}PRIVATE_REGION_ID=\n`);

		expect(output).not.toContain('PRIVATE_REGION_ID: deprecated');
	});
});

describe('validate-env requiredWith', () => {
	it('rejects a Sidecar base URL with no region ID', () => {
		const { code, output } = validate(
			`${BASE}PRIVATE_SIDECAR_API_BASE_URL=https://sidecar.onebusaway.org/api/v1\n`
		);

		expect(code).toBe(1);
		expect(output).toContain(
			'PRIVATE_SIDECAR_REGION_ID: required when PRIVATE_SIDECAR_API_BASE_URL is set'
		);
	});

	it('accepts a region ID supplied only under its deprecated name', () => {
		const { code } = validate(
			`${BASE}PRIVATE_SIDECAR_API_BASE_URL=https://sidecar.onebusaway.org/api/v1\nPRIVATE_REGION_ID=7\n`
		);

		expect(code).toBe(0);
	});

	it('does not require a region ID when no base URL is set', () => {
		const { code } = validate(BASE);

		expect(code).toBe(0);
	});
});

describe('validate-env shipped example', () => {
	it('validates .env.example cleanly', () => {
		const output = execFileSync('node', [script, join(root, '.env.example')], {
			encoding: 'utf-8'
		});

		expect(output).toContain('variables validated');
	});
});
