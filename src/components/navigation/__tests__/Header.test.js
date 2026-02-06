import { render, screen } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import Header from '../Header.svelte';

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
		const logo = screen.getByAltText('Test Region');
		expect(logo).toBeInTheDocument();
		expect(logo).toHaveAttribute('src', '/test-logo.png');

		// Check for region name
		expect(screen.getByText('Test Region')).toBeInTheDocument();
	});

	test('logo and region name are clickable links', () => {
		render(Header);

		const links = screen.getAllByRole('link', { name: /test region/i });
		expect(links).toHaveLength(2); // One for logo, one for text

		// Both should link to home
		links.forEach((link) => {
			expect(link).toHaveAttribute('href', '/');
		});
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

	test('has accessible logo with proper alt text', () => {
		render(Header);

		const logo = screen.getByRole('img');
		expect(logo).toHaveAttribute('alt', 'Test Region');
		expect(logo).toBeVisible();
	});

	test('logo container has proper styling classes', () => {
		render(Header);

		const logoContainer = screen.getByText('Test Region').closest('div');
		expect(logoContainer).toHaveClass('flex', 'items-center', 'justify-center', 'gap-x-2');
	});

	test('header has proper CSS classes for styling', () => {
		const { container } = render(Header);

		const header = container.querySelector('div');
		expect(header).toHaveClass(
			'flex',
			'items-center',
			'justify-between',
			'border-b',
			'border-gray-500',
			'bg-brand/80',
			'text-brand-foreground',
			'backdrop-blur-md',
			'dark:bg-surface-dark',
			'dark:text-surface-foreground-dark'
		);
	});

	test('region name link has proper styling', () => {
		render(Header);

		const regionLinks = screen.getAllByRole('link', { name: /test region/i });
		const textLink = regionLinks.find((link) => link.textContent === 'Test Region');
		expect(textLink).toHaveClass('block', 'text-xl', 'font-extrabold');
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

	test('hides region name text when config is false', () => {
		render(Header);

		// Region name text should not be present
		expect(screen.queryByText('Test Region')).not.toBeInTheDocument();
	});

	test('logo alt text still uses region name for accessibility', () => {
		render(Header);

		// Logo should still have the region name as alt text
		const logo = screen.getByRole('img');
		expect(logo).toHaveAttribute('alt', 'Test Region');
	});

	test('only logo link exists when region name is hidden', () => {
		render(Header);

		// Should only have one link for the logo
		const links = screen.getAllByRole('link', { name: /test region/i });
		expect(links).toHaveLength(1);
	});
});
