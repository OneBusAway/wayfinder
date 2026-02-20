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

// Validate each schema entry
for (const [name, rule] of Object.entries(schema)) {
	const value = parsed[name];
	const isPresent = name in parsed;

	// Check required
	if (rule.required && !isPresent) {
		errors.push(`${name}: missing (required)`);
		continue;
	}

	if (!isPresent) continue;

	// Check empty values
	if (value === '') {
		if (rule.allowEmpty) continue;

		// Detect unquoted hex colors that dotenv treated as comments
		const raw = rawLines.get(name) || '';
		if (rule.type === 'color' && raw.includes('#')) {
			errors.push(`${name}: hex color values must be quoted (e.g., "#78aa36")`);
		} else if (rule.required) {
			errors.push(`${name}: empty value (required)`);
		} else {
			warnings.push(`${name}: present but empty (set allowEmpty or remove)`);
		}
		continue;
	}

	// Type-specific validation
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

// Warn on unknown variables
const schemaKeys = new Set(Object.keys(schema));
for (const name of Object.keys(parsed)) {
	if (!schemaKeys.has(name)) {
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
