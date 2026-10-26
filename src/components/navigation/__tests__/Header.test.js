import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import Header from '../Header.svelte';

vi.mock('$app/environment', () => ({
	browser: true
}));

let mockPublicEnv = {
	PUBLIC_OBA_REGION_NAME: 'Test Region',
	PUBLIC_OBA_LOGO_URL: '/test-logo.png',
	PUBLIC_NAV_BAR_LINKS: '{"Home": "/", "About": "/about"}'
};

// Mock environment variables
vi.mock('$env/static/public', () => ({
	get PUBLIC_OBA_REGION_NAME() {
		return mockPublicEnv.PUBLIC_OBA_REGION_NAME;
	},
	get PUBLIC_OBA_LOGO_URL() {
		return mockPublicEnv.PUBLIC_OBA_LOGO_URL;
	},
	get PUBLIC_NAV_BAR_LINKS() {
		return mockPublicEnv.PUBLIC_NAV_BAR_LINKS;
	}
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
		mockPublicEnv = {
			PUBLIC_OBA_REGION_NAME: 'Test Region',
			PUBLIC_OBA_LOGO_URL: '/test-logo.png',
			PUBLIC_NAV_BAR_LINKS: '{"Home": "/", "About": "/about"}'
		};

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
		mockPublicEnv.PUBLIC_NAV_BAR_LINKS = '';

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

		const header = container.querySelector('header');
		expect(header).toHaveClass(
			'flex',
			'items-center',
			'justify-between',
			'border-b',
			'border-gray-500',
			'bg-brand-accent/80',
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

	test('hides image and displays region name when logo image fails to load', async () => {
		render(Header);

		const logo = screen.getByRole('img');
		expect(logo).toBeInTheDocument();

		await fireEvent.error(logo);

		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByText('Test Region')).toBeInTheDocument();

		const links = screen.getAllByRole('link', { name: /test region/i });
		expect(links).toHaveLength(1);
	});

	test('renders only region name when PUBLIC_OBA_LOGO_URL is empty', () => {
		mockPublicEnv.PUBLIC_OBA_LOGO_URL = '';

		render(Header);

		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByText('Test Region')).toBeInTheDocument();
	});

	test('dispatches openStopsTab event when logo or region name is clicked', async () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		render(Header);

		const links = screen.getAllByRole('link', { name: /test region/i });
		const logoLink = links[0];
		const regionNameLink = links[1];

		dispatchSpy.mockClear();
		await fireEvent.click(logoLink);
		expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'openStopsTab' }));

		dispatchSpy.mockClear();
		await fireEvent.click(regionNameLink);
		expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'openStopsTab' }));
	});

	test('does not dispatch openStopsTab on modified or non-primary clicks for logo and region name', async () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		render(Header);

		const links = screen.getAllByRole('link', { name: /test region/i });
		for (const link of links) {
			dispatchSpy.mockClear();

			// Ctrl-click
			await fireEvent.click(link, { ctrlKey: true });
			expect(dispatchSpy).not.toHaveBeenCalled();

			// Meta-click (Cmd-click on macOS)
			await fireEvent.click(link, { metaKey: true });
			expect(dispatchSpy).not.toHaveBeenCalled();

			// Shift-click
			await fireEvent.click(link, { shiftKey: true });
			expect(dispatchSpy).not.toHaveBeenCalled();

			// Alt-click
			await fireEvent.click(link, { altKey: true });
			expect(dispatchSpy).not.toHaveBeenCalled();

			// Non-primary click
			await fireEvent.click(link, { button: 1 });
			expect(dispatchSpy).not.toHaveBeenCalled();
		}
	});

	test('keeps logo when image already completed successfully before hydration', () => {
		vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
		vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(120);

		render(Header);

		expect(screen.getByRole('img')).toBeInTheDocument();
		expect(screen.getByText('Test Region')).toBeInTheDocument();
	});

	test('falls back to region name when image failed before hydration', () => {
		vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
		vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);

		render(Header);

		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByText('Test Region')).toBeInTheDocument();
	});
});

describe('Header with region name hidden', () => {
	beforeEach(() => {
		mockPublicEnv = {
			PUBLIC_OBA_REGION_NAME: 'Test Region',
			PUBLIC_OBA_LOGO_URL: '/test-logo.png',
			PUBLIC_NAV_BAR_LINKS: '{"Home": "/", "About": "/about"}'
		};
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

	test('falls back to region name when region name is hidden but logo fails to load', async () => {
		render(Header);

		expect(screen.queryByText('Test Region')).not.toBeInTheDocument();
		const logo = screen.getByRole('img');
		expect(logo).toBeInTheDocument();

		await fireEvent.error(logo);

		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByText('Test Region')).toBeInTheDocument();
	});

	test('dispatches openStopsTab event when logo is clicked', async () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		render(Header);

		const logoLink = screen.getAllByRole('link', { name: /test region/i })[0];
		await fireEvent.click(logoLink);

		expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'openStopsTab' }));
	});

	test('does not dispatch openStopsTab on modified or non-primary clicks', async () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		render(Header);

		const logoLink = screen.getAllByRole('link', { name: /test region/i })[0];
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

	test('falls back to region name when image failed before hydration and region name is hidden', () => {
		vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
		vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);

		render(Header);

		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByText('Test Region')).toBeInTheDocument();
	});

	test('dispatches openStopsTab event when fallback region name is clicked after image failure', async () => {
		const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
		render(Header);

		const logo = screen.getByRole('img');
		await fireEvent.error(logo);

		const fallbackLink = screen.getByRole('link', { name: 'Test Region' });
		dispatchSpy.mockClear();
		await fireEvent.click(fallbackLink);

		expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'openStopsTab' }));
	});

	test('measures fallback region name in overflow calculation after image failure', async () => {
		let measuredRegionNameWidth = null;
		const originalQuerySelector = Element.prototype.querySelector;
		vi.spyOn(Element.prototype, 'querySelector').mockImplementation(function (selector) {
			const el = originalQuerySelector.call(this, selector);
			if (selector === '.region-name' && el) {
				Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 150 });
				measuredRegionNameWidth = el.offsetWidth;
			}
			return el;
		});

		render(Header);
		const logo = screen.getByRole('img');
		await fireEvent.error(logo);

		expect(measuredRegionNameWidth).toBe(150);
	});
});
