import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';

// This file exercises the REAL svelte-i18n (the global vitest-setup mock is
// bypassed) to verify how the i18n module sets the initial locale.
vi.unmock('$lib/i18n');
vi.mock('$app/environment', () => ({ browser: true }));

// Use the real svelte-i18n implementation, but force the "navigator" locale to a
// lazy-registered, non-English locale to mimic a Sound Transit visitor whose
// browser language is, e.g., Spanish.
vi.mock('svelte-i18n', async () => {
	const actual = await vi.importActual('svelte-i18n');
	return { ...actual, getLocaleFromNavigator: vi.fn(() => 'es') };
});

describe('i18n initial locale with a lazy-loaded locale', () => {
	it('bootstraps synchronously and applies the preferred lazy locale without a null-locale window', async () => {
		// No saved preference, so getInitialLocale() falls back to the (mocked)
		// navigator locale 'es', which must be lazy-loaded.
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });

		// `_` is svelte-i18n's alias for the $format store.
		const { locale, _ } = await import('svelte-i18n');
		await import('../i18n'); // executes init() as an import side effect

		// Crash guard: setting a lazy initial locale directly leaves $locale null
		// until the dynamic import resolves, so the first format call throws
		// "Cannot format a message without first setting the initial locale" and
		// hydration dies. Bootstrapping on 'en' keeps $locale set synchronously.
		expect(get(locale)).not.toBeNull();
		expect(() => get(_)('stop')).not.toThrow();

		// Second half of the fix: the preferred locale is actually applied once its
		// dictionary loads. Guards against the client-side switch block being dropped
		// (which would silently leave non-English visitors stuck on English).
		await vi.waitFor(() => expect(get(locale)).toBe('es'));
	});
});
