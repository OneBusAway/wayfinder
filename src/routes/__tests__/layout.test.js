import { render, screen } from '@testing-library/svelte';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import Layout from '$src/routes/+layout.svelte';

vi.mock('$lib/i18n', () => ({
	isRTL: vi.fn(() => false),
	languages: []
}));

vi.mock('$lib/systemTheme.js', () => ({
	initSystemTheme: vi.fn()
}));

vi.mock('$lib/Analytics', () => ({
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

	test('skip link text uses the i18n key, not hardcoded English', () => {
		const { container } = render(Layout);

		const skipLink = container.querySelector('a[href="#main-content"]');
		// The global svelte-i18n test mock returns the key unchanged.
		// Hardcoded text would produce "Skip to main content" (spaces).
		// A properly wired $t() call produces "skip_to_main_content" (the key).
		expect(skipLink?.textContent?.trim()).toBe('skip_to_main_content');
	});
});
