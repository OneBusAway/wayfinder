import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const browserState = vi.hoisted(() => ({ browser: true }));

vi.mock('$app/environment', () => ({
	get browser() {
		return browserState.browser;
	}
}));

import {
	getAnalyticsId,
	getDistanceCategory,
	analyticsDistanceToStop
} from '$lib/Insights/insightsUtils.js';

function stubLocalStorage() {
	let store = {};
	vi.stubGlobal('localStorage', {
		getItem: vi.fn((key) => (key in store ? store[key] : null)),
		setItem: vi.fn((key, value) => {
			store[key] = String(value);
		}),
		removeItem: vi.fn((key) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		})
	});
	return () => store;
}

describe('getAnalyticsId', () => {
	beforeEach(() => {
		browserState.browser = true;
		stubLocalStorage();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('generates and persists a new id when storage is empty', () => {
		const id = getAnalyticsId();
		expect(id).toBeTypeOf('string');
		expect(id.length).toBeGreaterThan(0);
		expect(localStorage.setItem).toHaveBeenCalledWith('wayfinder.analyticsId', id);
	});

	it('returns the same id across calls (persisted)', () => {
		const first = getAnalyticsId();
		const second = getAnalyticsId();
		expect(second).toBe(first);
		// Only the first call should have written to storage.
		expect(localStorage.setItem).toHaveBeenCalledTimes(1);
	});

	it('reuses an existing id already in storage instead of generating a new one', () => {
		localStorage.setItem('wayfinder.analyticsId', 'existing-id-123');
		const id = getAnalyticsId();
		expect(id).toBe('existing-id-123');
	});

	it('returns undefined without throwing when localStorage.getItem throws', () => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => {
				throw new Error('storage blocked');
			}),
			setItem: vi.fn()
		});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(() => getAnalyticsId()).not.toThrow();
		expect(getAnalyticsId()).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});

	it('returns undefined without throwing when localStorage.setItem throws', () => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn(() => null),
			setItem: vi.fn(() => {
				throw new Error('quota exceeded');
			})
		});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(getAnalyticsId()).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});

	it('returns undefined without throwing when crypto.randomUUID is unavailable', () => {
		vi.stubGlobal('crypto', {});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(() => getAnalyticsId()).not.toThrow();
		expect(getAnalyticsId()).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});

	it('returns undefined and never touches localStorage outside the browser (SSR)', () => {
		browserState.browser = false;
		const id = getAnalyticsId();
		expect(id).toBeUndefined();
		expect(localStorage.getItem).not.toHaveBeenCalled();
		expect(localStorage.setItem).not.toHaveBeenCalled();
	});
});

describe('getDistanceCategory', () => {
	it('categorizes short distances', () => {
		expect(getDistanceCategory(0.01)).toBe('User Distance: 00000-00050m');
	});

	it('categorizes the long tail', () => {
		expect(getDistanceCategory(10)).toBe('User Distance: 03200-INFINITY');
	});
});

describe('analyticsDistanceToStop', () => {
	it('returns a distance category string for two coordinates', () => {
		const category = analyticsDistanceToStop(47.6062, -122.3321, 47.6062, -122.3321);
		expect(category).toBe('User Distance: 00000-00050m');
	});
});
