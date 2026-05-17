import { describe, expect, it } from 'vitest';
import { getCustomErrorDetail, getErrorTranslationKeys } from '$lib/errors.js';

describe('getErrorTranslationKeys', () => {
	it('returns not found keys for 404', () => {
		expect(getErrorTranslationKeys(404)).toEqual({
			titleKey: 'errors.not_found_title',
			messageKey: 'errors.not_found_message'
		});
	});

	it('returns server error keys for 5xx', () => {
		expect(getErrorTranslationKeys(500)).toEqual({
			titleKey: 'errors.server_error_title',
			messageKey: 'errors.server_error_message'
		});
	});

	it('returns generic keys for other statuses', () => {
		expect(getErrorTranslationKeys(403)).toEqual({
			titleKey: 'errors.generic_title',
			messageKey: 'errors.generic_message'
		});
	});
});

describe('getCustomErrorDetail', () => {
	it('returns null for generic SvelteKit messages', () => {
		expect(getCustomErrorDetail({ message: 'Not Found' }, 404)).toBeNull();
		expect(getCustomErrorDetail({ message: 'Internal Error' }, 500)).toBeNull();
	});

	it('returns null for 5xx even with a custom message', () => {
		expect(getCustomErrorDetail({ message: 'Database unavailable' }, 503)).toBeNull();
	});

	it('returns trimmed custom messages for non-5xx errors', () => {
		expect(getCustomErrorDetail({ message: '  Stop not found  ' }, 404)).toBe('Stop not found');
	});
});
