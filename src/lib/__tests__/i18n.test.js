import { describe, it, expect, vi } from 'vitest';

// Unmock $lib/i18n first (it's mocked in vitest-setup.js)
vi.unmock('$lib/i18n');

// Mock svelte-i18n with all required exports for i18n.js to load
vi.mock('svelte-i18n', () => ({
	init: vi.fn(),
	addMessages: vi.fn(),
	register: vi.fn(),
	getLocaleFromNavigator: vi.fn(() => 'en')
}));

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: false
}));

// Now we can import the actual i18n module
import { languages, isRTL } from '../i18n';

describe('i18n', () => {
	describe('languages array', () => {
		it('has unique language codes', () => {
			const codes = languages.map((l) => l.code);
			const uniqueCodes = [...new Set(codes)];
			expect(codes.length).toBe(uniqueCodes.length);
		});
	});

	describe('isRTL', () => {
		it('returns true for Arabic', () => {
			expect(isRTL('ar')).toBe(true);
			expect(isRTL('AR')).toBe(true);
		});

		it('returns true for Persian', () => {
			expect(isRTL('fa')).toBe(true);
			expect(isRTL('FA')).toBe(true);
		});

		it('returns true for Hebrew', () => {
			expect(isRTL('he')).toBe(true);
		});

		it('returns true for Urdu', () => {
			expect(isRTL('ur')).toBe(true);
		});

		it('returns false for English', () => {
			expect(isRTL('en')).toBe(false);
		});

		it('returns false for Spanish', () => {
			expect(isRTL('es')).toBe(false);
		});

		it('returns false for Polish', () => {
			expect(isRTL('pl')).toBe(false);
		});

		it('returns false for Chinese', () => {
			expect(isRTL('zh-CN')).toBe(false);
			expect(isRTL('zh-TW')).toBe(false);
		});

		it('is case-insensitive', () => {
			expect(isRTL('Ar')).toBe(true);
			expect(isRTL('En')).toBe(false);
			expect(isRTL('Fa')).toBe(true);
		});

		it('handles empty string', () => {
			expect(isRTL('')).toBe(false);
		});
	});
});
