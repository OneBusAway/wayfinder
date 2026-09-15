import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const envPath = process.argv[2] ? resolve(process.argv[2]) : resolve(root, '.env');
const schemaPath = resolve(root, 'env-schema.json');

// Load schema
let schema;
try {
	schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
} catch (err) {
	console.error(`Failed to load schema from ${schemaPath}: ${err.message}`);
	process.exit(1);
}

// Load .env file
let envContent;
try {
	envContent = readFileSync(envPath, 'utf-8');
} catch (err) {
	console.error(`Failed to read env file at ${envPath}: ${err.message}`);
	process.exit(1);
}

const parsed = dotenv.parse(envContent);

// Build a map of raw lines so we can detect values eaten by dotenv's # comment parsing
const rawLines = new Map();
for (const line of envContent.split('\n')) {
	const match = line.match(/^\s*([A-Za-z_]\w*)\s*=/);
	if (match) rawLines.set(match[1], line);
}

const errors = [];
const warnings = [];

/**
 * Checks one variable's value against a schema rule, reporting by pushing onto
 * the module-level `errors` and `warnings` arrays. Deprecated aliases are
 * checked against their replacement's rule, so a rule is written down once.
 *
 * @param {string} name variable name to report against
 * @param {string} value the parsed value
 * @param {object} rule the schema entry to check against
 * @returns {void}
 */
function validateVariable(name, value, rule) {
	if (value === '') {
		if (rule.allowEmpty) return;

		// Detect unquoted hex colors that dotenv treated as comments
		const raw = rawLines.get(name) || '';
		if (rule.type === 'color' && raw.includes('#')) {
			errors.push(`${name}: hex color values must be quoted (e.g., "#78aa36")`);
		} else if (rule.required) {
			errors.push(`${name}: empty value (required)`);
		} else {
			warnings.push(`${name}: present but empty (set allowEmpty or remove)`);
		}
		return;
	}

	switch (rule.type) {
		case 'url':
			try {
				new URL(value);
			} catch {
				errors.push(`${name}: invalid URL "${value}"`);
			}
			break;

		case 'number': {
			const num = Number(value);
			if (isNaN(num)) {
				errors.push(`${name}: not a valid number "${value}"`);
			} else {
				if (rule.min !== undefined && num < rule.min) {
					errors.push(`${name}: ${num} is below minimum ${rule.min}`);
				}
				if (rule.max !== undefined && num > rule.max) {
					errors.push(`${name}: ${num} is above maximum ${rule.max}`);
				}
			}
			break;
		}

		case 'boolean':
			if (value !== 'true' && value !== 'false') {
				errors.push(`${name}: expected "true" or "false", got "${value}"`);
			}
			break;

		case 'enum':
			if (rule.enum && !rule.enum.includes(value)) {
				errors.push(`${name}: "${value}" is not one of [${rule.enum.join(', ')}]`);
			}
			break;

		case 'color':
			if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
				errors.push(`${name}: invalid hex color "${value}" (expected #RGB, #RRGGBB, or #RRGGBBAA)`);
			}
			break;

		case 'json':
			try {
				JSON.parse(value);
			} catch {
				errors.push(`${name}: invalid JSON — ${value}`);
			}
			break;

		case 'string':
			break;

		default:
			warnings.push(`${name}: unknown type "${rule.type}" in schema`);
			break;
	}
}

// Validate each schema entry, plus any pre-rename aliases still in use
const deprecatedNames = new Set();

/** The value the app will actually read for `name`, counting empty as unset. */
function effectiveValue(name) {
	if (parsed[name]) return parsed[name];
	for (const alias of schema[name]?.deprecatedNames ?? []) {
		if (parsed[alias]) return parsed[alias];
	}
	return undefined;
}

for (const [name, rule] of Object.entries(schema)) {
	for (const alias of rule.deprecatedNames ?? []) {
		deprecatedNames.add(alias);

		// An empty alias has no effect either way, so there is nothing to say.
		if (!parsed[alias]) continue;

		// `readSetting()` in src/lib/sidecarConfig.js prefers the current name only
		// when it holds a non-empty value, so an empty replacement means the alias
		// is still what takes effect. A superseded alias is not validated: a value
		// the app never reads must not be able to fail the build.
		if (parsed[name]) {
			warnings.push(`${alias}: deprecated and ignored — ${name} is also set`);
		} else {
			warnings.push(`${alias}: deprecated, rename to ${name}`);
			validateVariable(alias, parsed[alias], rule);
		}
	}

	const isPresent = name in parsed;

	if (rule.required && !isPresent && effectiveValue(name) === undefined) {
		errors.push(`${name}: missing (required)`);
		continue;
	}

	if (!isPresent) continue;

	validateVariable(name, parsed[name], rule);
}

// Cross-field requirements, e.g. a region ID is meaningless without a base URL
// but mandatory once one is set.
for (const [name, rule] of Object.entries(schema)) {
	if (!rule.requiredWith) continue;
	if (effectiveValue(rule.requiredWith) && !effectiveValue(name)) {
		errors.push(`${name}: required when ${rule.requiredWith} is set`);
	}
}

// Warn on unknown variables
const schemaKeys = new Set(Object.keys(schema));
for (const name of Object.keys(parsed)) {
	if (!schemaKeys.has(name) && !deprecatedNames.has(name)) {
		warnings.push(`${name}: not defined in env-schema.json`);
	}
}

// Print results
if (errors.length === 0 && warnings.length === 0) {
	console.log(`\u2714 ${envPath}: all ${Object.keys(schema).length} variables validated`);
	process.exit(0);
}

if (warnings.length > 0) {
	console.log(`\nWarnings (${warnings.length}):`);
	for (const w of warnings) {
		console.log(`  \u26A0 ${w}`);
	}
}

if (errors.length > 0) {
	console.log(`\nErrors (${errors.length}):`);
	for (const e of errors) {
		console.log(`  \u2716 ${e}`);
	}

	const requiredCount = Object.values(schema).filter((r) => r.required).length;
	const missingCount = errors.filter((e) => e.endsWith('(required)')).length;
	if (missingCount >= requiredCount / 2) {
		console.log('\nHint: run `cp .env.example .env` and fill in your values.');
	}

	console.log('');
	process.exit(1);
}

console.log('');
