import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, describe, vi } from 'vitest';
import OverflowMenu from '../OverflowMenu.svelte';
import { stubLayoutBox } from '../../../tests/helpers/test-utils';

let currentLocale = 'en';
const localeSubscribers = new Set();
const messages = {
	en: {
		'header.home': 'Home',
		'header.about': 'About',
		'header.contact': 'Contact',
		'header.fares_and_tolls': 'Fares & Tolls'
	},
	es: {
		'header.home': 'Inicio',
		'header.about': 'Acerca de',
		'header.contact': 'Contacto',
		'header.fares_and_tolls': 'Tarifas y peajes'
	}
};

vi.mock('svelte-i18n', () => ({
	locale: {
		subscribe: (fn) => {
			localeSubscribers.add(fn);
			fn(currentLocale);
			return () => localeSubscribers.delete(fn);
		},
		set: (newLoc) => {
			currentLocale = newLoc;
			localeSubscribers.forEach((fn) => fn(currentLocale));
		}
	},
	t: {
		subscribe: (fn) => {
			fn((key, options) => messages[currentLocale]?.[key] ?? options?.default ?? key);
			return () => {};
		}
	}
}));

describe('OverflowMenu', () => {
	const mockLinks = [
		{ key: 'About', value: '/about' },
		{ key: 'Contact', value: '/contact' },
		{ key: 'GitHub', value: 'https://github.com/OneBusAway' }
	];

	afterEach(() => {
		currentLocale = 'en';
		vi.restoreAllMocks();
	});

	function renderOverflowMenu(props) {
		const result = render(OverflowMenu, props);
		const button = screen.getByRole('button', { name: 'More navigation options' });
		stubLayoutBox(button);
		return { ...result, button };
	}

	test('renders trigger button in collapsed state initially', () => {
		render(OverflowMenu, { links: mockLinks });

		const button = screen.getByRole('button', { name: 'More navigation options' });
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute('aria-expanded', 'false');
		expect(button).toHaveAttribute('aria-haspopup', 'dialog');

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});

	test('opens popover and displays all links when trigger button is clicked', async () => {
		const user = userEvent.setup();
		const { button } = renderOverflowMenu({ links: mockLinks });

		await user.click(button);

		const dialog = await screen.findByRole('dialog', { name: 'Navigation options' });
		expect(button).toHaveAttribute('aria-controls', dialog.id);

		for (const { key, value } of mockLinks) {
			const link = await screen.findByRole('link', { name: key });
			expect(link).toHaveAttribute('href', value);
		}

		expect(button).toHaveAttribute('aria-expanded', 'true');
	});

	test('renders empty menu when no links are provided', async () => {
		const user = userEvent.setup();
		const { button } = renderOverflowMenu({ links: [] });

		await user.click(button);

		await screen.findByRole('dialog', { name: 'Navigation options' });
		expect(button).toHaveAttribute('aria-expanded', 'true');
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});

	test('closes popover when a link is clicked', async () => {
		const user = userEvent.setup();
		const { button } = renderOverflowMenu({ links: mockLinks });

		await user.click(button);

		const firstLink = await screen.findByRole('link', { name: 'About' });
		firstLink.addEventListener('click', (e) => e.preventDefault(), { once: true });
		await user.click(firstLink);

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});
		expect(screen.queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
		expect(button).toHaveAttribute('aria-expanded', 'false');
	});

	test('closes popover when clicking outside', async () => {
		const user = userEvent.setup();
		const { button } = renderOverflowMenu({ links: mockLinks });

		await user.click(button);

		expect(button).toHaveAttribute('aria-expanded', 'true');
		expect(await screen.findByRole('link', { name: 'About' })).toBeInTheDocument();

		// jsdom lays every element out as a 0x0 box at the origin, and Bits UI only
		// dismisses when the pointer lands outside the content's rect, so click off-origin
		await user.pointer({
			coords: { clientX: 1, clientY: 1 },
			keys: '[MouseLeft]',
			target: document.body
		});

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});
		expect(screen.queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
		expect(button).toHaveAttribute('aria-expanded', 'false');
	});

	test('updates rendered links when links prop changes', async () => {
		const user = userEvent.setup();
		const { button, rerender } = renderOverflowMenu({ links: mockLinks });

		await user.click(button);

		expect(await screen.findByRole('link', { name: 'About' })).toBeInTheDocument();

		await rerender({ links: [{ key: 'Home', value: '/' }] });

		expect(screen.queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
		const homeLink = await screen.findByRole('link', { name: 'Home' });
		expect(homeLink).toHaveAttribute('href', '/');
	});

	test('translates link labels when switching languages', async () => {
		currentLocale = 'es';
		const user = userEvent.setup();
		const { button } = renderOverflowMenu({ links: mockLinks });

		await user.click(button);

		expect(await screen.findByRole('link', { name: 'Acerca de' })).toBeInTheDocument();
		expect(await screen.findByRole('link', { name: 'Contacto' })).toBeInTheDocument();
		expect(await screen.findByRole('link', { name: 'GitHub' })).toBeInTheDocument();
	});
});
