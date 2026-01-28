import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unmock $lib/i18n first (it's mocked in vitest-setup.js)
vi.unmock('$lib/i18n');

// Use vi.hoisted() to create variables that are hoisted before mocks
const { mockBrowserState, mockGetLocaleFromNavigatorFn } = vi.hoisted(() => {
	const browserState = { value: true }; // Start with true so module initialization works
	const getLocaleFromNavigatorFn = vi.fn(() => 'en');
	return {
		mockBrowserState: browserState,
		mockGetLocaleFromNavigatorFn: getLocaleFromNavigatorFn
	};
});

// Mock $app/environment first - use hoisted state
vi.mock('$app/environment', () => ({
	get browser() {
		return mockBrowserState.value;
	}
}));

// Mock svelte-i18n with all required exports for i18n.js to load
vi.mock('svelte-i18n', async () => {
	const actual = await vi.importActual('svelte-i18n');
	return {
		...actual,
		init: vi.fn(),
		addMessages: vi.fn(),
		register: vi.fn(),
		getLocaleFromNavigator: mockGetLocaleFromNavigatorFn
	};
});

// Now we can import the actual i18n module
import { languages, isRTL, getInitialLocale } from '../i18n';

// Alias for convenience
const mockGetLocaleFromNavigator = mockGetLocaleFromNavigatorFn;

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

	describe('getInitialLocale', () => {
		// Create a proper localStorage mock that actually stores values
		let localStorageStore = {};
		const localStorageMock = {
			getItem: vi.fn((key) => localStorageStore[key] || null),
			setItem: vi.fn((key, value) => {
				localStorageStore[key] = value;
			}),
			removeItem: vi.fn((key) => {
				delete localStorageStore[key];
			}),
			clear: vi.fn(() => {
				localStorageStore = {};
			})
		};

		beforeEach(() => {
			// Reset mocks
			vi.clearAllMocks();
			mockBrowserState.value = true;
			mockGetLocaleFromNavigator.mockReturnValue('en');
			// Replace localStorage with our mock
			Object.defineProperty(global, 'localStorage', {
				value: localStorageMock,
				writable: true,
				configurable: true
			});
			// Clear localStorage
			localStorageMock.clear();
		});

		it('returns saved locale from localStorage when valid', () => {
			global.localStorage.setItem('locale', 'es');
			mockGetLocaleFromNavigator.mockReturnValue('en');

			const locale = getInitialLocale();
			expect(locale).toBe('es');
		});

		it('falls back to navigator when localStorage locale is invalid', () => {
			global.localStorage.setItem('locale', 'invalid-locale');
			mockGetLocaleFromNavigator.mockReturnValue('fr');

			const locale = getInitialLocale();
			expect(locale).toBe('fr');
			expect(mockGetLocaleFromNavigator).toHaveBeenCalled();
		});

		it('falls back to navigator when localStorage is empty', () => {
			global.localStorage.clear();
			mockGetLocaleFromNavigator.mockReturnValue('pl');

			const locale = getInitialLocale();
			expect(locale).toBe('pl');
			expect(mockGetLocaleFromNavigator).toHaveBeenCalled();
		});

		it('falls back to navigator when localStorage.getItem throws', () => {
			const originalGetItem = global.localStorage.getItem;
			global.localStorage.getItem = vi.fn(() => {
				throw new Error('QuotaExceededError');
			});
			mockGetLocaleFromNavigator.mockReturnValue('de');

			const locale = getInitialLocale();
			expect(locale).toBe('de');
			expect(mockGetLocaleFromNavigator).toHaveBeenCalled();

			// Restore original
			global.localStorage.getItem = originalGetItem;
		});

		it('falls back to navigator when browser is false', () => {
			mockBrowserState.value = false;
			mockGetLocaleFromNavigator.mockReturnValue('ja');

			const locale = getInitialLocale();
			expect(locale).toBe('ja');
			expect(mockGetLocaleFromNavigator).toHaveBeenCalled();
		});

		it('validates saved locale exists in languages array', () => {
			global.localStorage.setItem('locale', 'zh-CN');
			mockGetLocaleFromNavigator.mockReturnValue('en');

			const locale = getInitialLocale();
			expect(locale).toBe('zh-CN');
		});

		it('rejects saved locale that does not exist in languages array', () => {
			global.localStorage.setItem('locale', 'xx-XX');
			mockGetLocaleFromNavigator.mockReturnValue('en');

			const locale = getInitialLocale();
			expect(locale).toBe('en');
			expect(mockGetLocaleFromNavigator).toHaveBeenCalled();
		});
	});
});
