import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import Header from '../Header.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock environment variables
vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_REGION_NAME: 'Test Region',
	PUBLIC_OBA_LOGO_URL: '/test-logo.png',
	PUBLIC_NAV_BAR_LINKS: '{"Home": "/", "About": "/about"}'
}));

// Set default value for the global define
globalThis.__SHOW_REGION_NAME_IN_NAV_BAR__ = true;

// Mock ThemeSwitcher component
vi.mock('$lib/ThemeSwitch/ThemeSwitcher.svelte', () => ({
	default: () => '<div data-testid="theme-switcher">Theme Switcher</div>'
}));

// Mock OverflowMenu component
vi.mock('../OverflowMenu.svelte', () => ({
	default: () => '<div data-testid="overflow-menu">Overflow Menu</div>'
}));

// Mock i18n module (needed by LanguageSwitcher)
vi.mock('$lib/i18n', () => ({
	languages: [
		{ code: 'en', nativeName: 'English', englishName: 'English' },
		{ code: 'es', nativeName: 'Español', englishName: 'Spanish' }
	]
}));

// Mock LanguageSwitcher component
vi.mock('../LanguageSwitcher/LanguageSwitcher.svelte', () => ({
	default: () => '<div data-testid="language-switcher">Language Switcher</div>'
}));

// Mock environment variable for LanguageSwitcher
vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true' }
}));

describe('Header', () => {
	beforeEach(() => {
		// Mock ResizeObserver
		global.ResizeObserver = vi.fn().mockImplementation(() => ({
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn()
		}));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('renders header with logo and region name', () => {
		render(Header);

		// Check for logo
		const logo = screen.getByRole('presentation');
		expect(logo).toBeInTheDocument();
		expect(logo).toHaveAttribute('src', '/test-logo.png');

		// Check for region name
		expect(screen.getByText('Test Region')).toBeInTheDocument();
	});

	test('logo and region name share a single home link', () => {
		render(Header);

		const link = screen.getByRole('link', { name: 'Test Region' });
		expect(link).toHaveAttribute('href', '/');
		expect(link).toContainElement(screen.getByRole('presentation'));
	});

	test('has proper semantic structure', () => {
		render(Header);

		// Should have main header content
		const headerContent = screen.getByText('Test Region');
		expect(headerContent).toBeInTheDocument();
	});

	test('renders without navigation links when PUBLIC_NAV_BAR_LINKS is empty', () => {
		// This test will use the mocked empty value
		vi.doMock('$env/static/public', () => ({
			PUBLIC_OBA_REGION_NAME: 'Test Region',
			PUBLIC_OBA_LOGO_URL: '/test-logo.png',
			PUBLIC_NAV_BAR_LINKS: ''
		}));

		render(Header);

		// Should still render logo and region name
		expect(screen.getByText('Test Region')).toBeInTheDocument();
	});
});

describe('Header with region name hidden', () => {
	beforeEach(() => {
		globalThis.__SHOW_REGION_NAME_IN_NAV_BAR__ = false;

		// Mock ResizeObserver
		global.ResizeObserver = vi.fn().mockImplementation(() => ({
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn()
		}));
	});

	afterEach(() => {
		globalThis.__SHOW_REGION_NAME_IN_NAV_BAR__ = true;
		vi.restoreAllMocks();
	});

	test('visually hides region name text when config is false', () => {
		render(Header);

		const regionName = screen.getByText('Test Region');
		expect(regionName).toHaveClass('sr-only');
		expect(regionName).not.toHaveClass('region-name');
	});

	test('logo stays decorative and the link is still named for screen readers', () => {
		render(Header);

		expect(screen.getByRole('presentation')).toHaveAttribute('alt', '');
		expect(screen.getByRole('link', { name: 'Test Region' })).toBeInTheDocument();
	});

	test('dispatches openStopsTab event when logo is clicked', async () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		render(Header);

		const logoLink = screen.getByRole('link', { name: 'Test Region' });
		await fireEvent.click(logoLink);

		expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'openStopsTab' }));
	});

	test('does not dispatch openStopsTab on modified or non-primary clicks', async () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		render(Header);

		const logoLink = screen.getByRole('link', { name: 'Test Region' });
		dispatchSpy.mockClear();

		// Ctrl-click
		await fireEvent.click(logoLink, { ctrlKey: true });
		expect(dispatchSpy).not.toHaveBeenCalled();

		// Meta-click (Cmd-click on macOS)
		await fireEvent.click(logoLink, { metaKey: true });
		expect(dispatchSpy).not.toHaveBeenCalled();

		// Shift-click
		await fireEvent.click(logoLink, { shiftKey: true });
		expect(dispatchSpy).not.toHaveBeenCalled();

		// Alt-click
		await fireEvent.click(logoLink, { altKey: true });
		expect(dispatchSpy).not.toHaveBeenCalled();

		// Non-primary click
		await fireEvent.click(logoLink, { button: 1 });
		expect(dispatchSpy).not.toHaveBeenCalled();
	});
});
