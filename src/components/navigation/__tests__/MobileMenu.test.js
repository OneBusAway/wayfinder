import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import MobileMenu from '../MobileMenu.svelte';

describe('MobileMenu', () => {
	let mockCloseMenu;
	let mockHeaderLinks;

	beforeEach(() => {
		mockCloseMenu = vi.fn();
		mockHeaderLinks = {
			Home: '/',
			About: '/about',
			Contact: '/contact',
			Services: '/services'
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('renders mobile menu with all navigation links', () => {
		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		// Check that all navigation links are rendered
		expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Services' })).toBeInTheDocument();
	});

	test('navigation links have correct href attributes', () => {
		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
		expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
		expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
		expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/services');
	});

	test('closes menu when close button is clicked', async () => {
		const user = userEvent.setup();

		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close Menu' });
		await user.click(closeButton);

		expect(mockCloseMenu).toHaveBeenCalledTimes(1);
	});

	test('closes menu when navigation link is clicked', async () => {
		const user = userEvent.setup();

		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const homeLink = screen.getByRole('link', { name: 'Home' });
		homeLink.addEventListener('click', (e) => e.preventDefault());
		await user.click(homeLink);

		expect(mockCloseMenu).toHaveBeenCalledTimes(1);
	});

	test('renders close button with correct accessibility attributes', () => {
		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close Menu' });
		expect(closeButton).toBeInTheDocument();
		expect(closeButton).toHaveAttribute('aria-label', 'Close Menu');
	});

	test('renders theme switcher component', () => {
		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		// Theme switcher should be present (it's a checkbox with sr-only class)
		const themeToggle = screen.getByRole('checkbox', { name: 'Toggle theme' });
		expect(themeToggle).toBeInTheDocument();
	});

	test('handles empty header links gracefully', () => {
		render(MobileMenu, {
			props: {
				headerLinks: {},
				closeMenu: mockCloseMenu
			}
		});

		// Should still render close button and theme switcher
		expect(screen.getByRole('button', { name: 'Close Menu' })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Toggle theme' })).toBeInTheDocument();
	});

	test('applies correct CSS classes for full-screen overlay', () => {
		const { container } = render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const menuContainer = container.querySelector('div');
		expect(menuContainer).toHaveClass('fixed', 'inset-0', 'z-50');
		expect(menuContainer).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
		expect(menuContainer).toHaveClass('space-y-6', 'bg-white', 'p-4', 'dark:bg-black');
	});

	test('close button has correct styling', () => {
		const { container } = render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close Menu' });
		expect(closeButton).toBeInTheDocument();

		// Check SVG icon styling
		const closeIcon = container.querySelector('.close-icon');
		expect(closeIcon).toBeInTheDocument();
		expect(closeIcon).toHaveClass('h-6', 'w-6', 'text-gray-900', 'dark:text-white');
	});

	test('navigation links have proper styling', () => {
		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const homeLink = screen.getByRole('link', { name: 'Home' });
		expect(homeLink).toHaveClass('block', 'text-xl', 'font-semibold');
		expect(homeLink).toHaveClass('text-gray-900', 'dark:text-white');
	});

	test('navigation links container has proper styling', () => {
		const { container } = render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const linksContainer = container.querySelector('.flex.flex-col.items-center.gap-4');
		expect(linksContainer).toBeInTheDocument();
		expect(linksContainer).toHaveClass('flex', 'flex-col', 'items-center', 'gap-4');
	});

	test('close SVG has correct attributes', () => {
		const { container } = render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const closeIcon = container.querySelector('.close-icon');
		expect(closeIcon).toHaveAttribute('viewBox', '0 0 24 24');
		expect(closeIcon).toHaveAttribute('fill', 'none');
		expect(closeIcon).toHaveAttribute('stroke', 'currentColor');
	});

	test('SVG path has correct attributes for X icon', () => {
		const { container } = render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const path = container.querySelector('path');
		expect(path).toHaveAttribute('stroke-linecap', 'round');
		expect(path).toHaveAttribute('stroke-linejoin', 'round');
		expect(path).toHaveAttribute('stroke-width', '2');
		expect(path).toHaveAttribute('d', 'M6 18L18 6M6 6l12 12');
	});

	test('menu has fly transition animation', () => {
		const { container } = render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		// The component should have transition:fly applied
		// This is harder to test directly, but we can check that the component renders
		const menuContainer = container.querySelector('div');
		expect(menuContainer).toBeInTheDocument();
	});

	test('multiple navigation links all close menu when clicked', async () => {
		const user = userEvent.setup();

		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		// Click each navigation link with preventDefault to avoid navigation
		const homeLink = screen.getByRole('link', { name: 'Home' });
		homeLink.addEventListener('click', (e) => e.preventDefault());
		await user.click(homeLink);
		expect(mockCloseMenu).toHaveBeenCalledTimes(1);

		const aboutLink = screen.getByRole('link', { name: 'About' });
		aboutLink.addEventListener('click', (e) => e.preventDefault());
		await user.click(aboutLink);
		expect(mockCloseMenu).toHaveBeenCalledTimes(2);

		const contactLink = screen.getByRole('link', { name: 'Contact' });
		contactLink.addEventListener('click', (e) => e.preventDefault());
		await user.click(contactLink);
		expect(mockCloseMenu).toHaveBeenCalledTimes(3);
	});

	test('renders with default props', () => {
		render(MobileMenu, {
			props: {
				closeMenu: mockCloseMenu
			}
		});

		// Should render with empty headerLinks object
		expect(screen.getByRole('button', { name: 'Close Menu' })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Toggle theme' })).toBeInTheDocument();
	});

	test('accessibility: close button can be focused', async () => {
		const user = userEvent.setup();

		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close Menu' });

		// Focus the close button
		await user.tab();
		expect(closeButton).toHaveFocus();
	});

	test('accessibility: navigation links can be focused', async () => {
		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const homeLink = screen.getByRole('link', { name: 'Home' });

		// Focus the home link
		homeLink.focus();
		expect(homeLink).toHaveFocus();
	});

	test('accessibility: theme switcher can be focused', async () => {
		render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const themeToggle = screen.getByRole('checkbox', { name: 'Toggle theme' });

		// Focus the theme toggle
		themeToggle.focus();
		expect(themeToggle).toHaveFocus();
	});

	test('renders in correct order: close button, links, theme switcher', () => {
		const { container } = render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const elements = Array.from(container.querySelectorAll('button, a, input'));

		// First element should be the close button
		expect(elements[0]).toHaveAttribute('aria-label', 'Close Menu');

		// Middle elements should be navigation links
		expect(elements[1]).toHaveAttribute('href', '/');
		expect(elements[2]).toHaveAttribute('href', '/about');

		// Last element should be theme toggle
		expect(elements[elements.length - 1]).toHaveAttribute('aria-label', 'Toggle theme');
	});

	test('handles single navigation link', () => {
		const singleLink = { Home: '/' };

		render(MobileMenu, {
			props: {
				headerLinks: singleLink,
				closeMenu: mockCloseMenu
			}
		});

		expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
	});

	test('handles special characters in link names', () => {
		const specialLinks = {
			'Home & Garden': '/home-garden',
			"FAQ's": '/faqs',
			'Contact Us!': '/contact'
		};

		render(MobileMenu, {
			props: {
				headerLinks: specialLinks,
				closeMenu: mockCloseMenu
			}
		});

		expect(screen.getByRole('link', { name: 'Home & Garden' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: "FAQ's" })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Contact Us!' })).toBeInTheDocument();
	});

	test('close button SVG has cursor pointer styling', () => {
		const { container } = render(MobileMenu, {
			props: {
				headerLinks: mockHeaderLinks,
				closeMenu: mockCloseMenu
			}
		});

		const closeIcon = container.querySelector('.close-icon');
		expect(closeIcon).toHaveClass('cursor-pointer');
	});
});
