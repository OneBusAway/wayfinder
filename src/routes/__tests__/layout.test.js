import { render } from '@testing-library/svelte';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import Layout from '$src/routes/+layout.svelte';
import en from '../../locales/en.json';

// Distinct from en.skip_to_main_content so the render test proves $t() is called
// rather than a hardcoded English literal that happens to match the locale file.
const RESOLVED_SKIP_LABEL = 'Resolved skip-to-main label';

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => {
				if (key === 'skip_to_main_content') {
					return RESOLVED_SKIP_LABEL;
				}
				return en[key] ?? key;
			});
			return { unsubscribe: () => {} };
		})
	},
	_: vi.fn((key) => en[key] ?? key),
	addMessages: vi.fn(),
	init: vi.fn(),
	getLocaleFromNavigator: vi.fn(() => 'en'),
	locale: {
		subscribe: vi.fn((fn) => {
			fn('en');
			return () => {};
		})
	}
}));

vi.mock('$lib/i18n', () => ({
	isRTL: vi.fn(() => false),
	languages: []
}));

vi.mock('$lib/systemTheme.js', () => ({
	initSystemTheme: vi.fn()
}));

vi.mock('$lib/Insights', () => ({
	default: { reportPageView: vi.fn() }
}));

vi.mock('$components/navigation/Header.svelte', () => ({
	default: () => null
}));

describe('Layout skip-to-content link', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('skip link exists and points at #main-content', () => {
		const { container } = render(Layout);

		const skipLink = container.querySelector('a[href="#main-content"]');
		expect(skipLink).toBeInTheDocument();
	});

	test('skip link does not have tabindex="-1" — must be reachable by Tab', () => {
		const { container } = render(Layout);

		const skipLink = container.querySelector('a[href="#main-content"]');
		expect(skipLink).not.toHaveAttribute('tabindex', '-1');
	});

	test('main landmark has tabindex="-1" so focus lands there after skip', () => {
		const { container } = render(Layout);

		const main = container.querySelector('main#main-content');
		expect(main).toBeInTheDocument();
		expect(main).toHaveAttribute('tabindex', '-1');
	});

	test('skip_to_main_content is defined in en locale data', () => {
		expect(en.skip_to_main_content).toBeTruthy();
		expect(typeof en.skip_to_main_content).toBe('string');
		expect(en.skip_to_main_content.trim().length).toBeGreaterThan(0);
	});

	test('skip link text is resolved via $t(skip_to_main_content)', () => {
		const { container } = render(Layout);

		const skipLink = container.querySelector('a[href="#main-content"]');
		expect(skipLink?.textContent?.trim()).toBe(RESOLVED_SKIP_LABEL);
		expect(skipLink?.textContent?.trim()).not.toBe('skip_to_main_content');
	});
});

// Dark-mode focus styling (dark:focus:*) and verifying focus actually moves to
// <main> after activating the skip link need a real browser (Tailwind variants
// do not compute under jsdom; fragment navigation is not implemented). Track in
// a Playwright a11y test when e2e coverage is added (#502).
