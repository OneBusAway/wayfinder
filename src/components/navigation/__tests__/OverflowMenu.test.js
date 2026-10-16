import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe } from 'vitest';
import OverflowMenu from '../OverflowMenu.svelte';

describe('OverflowMenu', () => {
	const mockLinks = [
		{ key: 'About', value: '/about' },
		{ key: 'Contact', value: '/contact' },
		{ key: 'GitHub', value: 'https://github.com/OneBusAway' }
	];

	test('renders trigger button in collapsed state initially', () => {
		render(OverflowMenu, { links: mockLinks });

		const button = screen.getByRole('button', { name: 'More navigation options' });
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute('aria-expanded', 'false');
		expect(button).toHaveAttribute('aria-haspopup', 'dialog');

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});

	test('opens popover and displays all links when trigger button is clicked', async () => {
		const user = userEvent.setup();
		render(OverflowMenu, { links: mockLinks });

		const button = screen.getByRole('button', { name: 'More navigation options' });
		await user.click(button);

		for (const { key, value } of mockLinks) {
			const link = screen.getByText(key);
			expect(link.tagName).toBe('A');
			expect(link).toHaveAttribute('href', value);
		}
		expect(button).toHaveAttribute('aria-expanded', 'true');
	});

	test('renders empty menu when no links are provided', async () => {
		const user = userEvent.setup();
		render(OverflowMenu, { links: [] });

		const button = screen.getByRole('button', { name: 'More navigation options' });
		await user.click(button);

		expect(button).toHaveAttribute('aria-expanded', 'true');
		expect(
			document.getElementById(button.getAttribute('aria-controls')).querySelector('a')
		).toBeNull();
	});

	test('closes popover when a link is clicked', async () => {
		const user = userEvent.setup();
		render(OverflowMenu, { links: mockLinks });

		const button = screen.getByRole('button', { name: 'More navigation options' });
		await user.click(button);

		const firstLink = screen.getByText('About');
		firstLink.addEventListener('click', (e) => e.preventDefault(), { once: true });
		await user.click(firstLink);

		await waitFor(() => {
			expect(screen.queryByText('About')).not.toBeInTheDocument();
		});
		expect(button).toHaveAttribute('aria-expanded', 'false');
	});

	test('closes popover when clicking outside', async () => {
		const user = userEvent.setup();
		render(OverflowMenu, { links: mockLinks });

		const button = screen.getByRole('button', { name: 'More navigation options' });
		await user.click(button);

		expect(button).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText('About')).toBeInTheDocument();

		// jsdom lays every element out as a 0x0 box at the origin, and Bits UI only
		// dismisses when the pointer lands outside the content's rect, so click off-origin
		await user.pointer({
			coords: { clientX: 1, clientY: 1 },
			keys: '[MouseLeft]',
			target: document.body
		});

		await waitFor(() => {
			expect(screen.queryByText('About')).not.toBeInTheDocument();
		});
		expect(button).toHaveAttribute('aria-expanded', 'false');
	});

	test('updates rendered links when links prop changes', async () => {
		const user = userEvent.setup();
		const { rerender } = render(OverflowMenu, { links: mockLinks });

		const button = screen.getByRole('button', { name: 'More navigation options' });
		await user.click(button);

		expect(screen.getByText('About')).toBeInTheDocument();

		await rerender({ links: [{ key: 'Home', value: '/' }] });

		expect(screen.queryByText('About')).not.toBeInTheDocument();
		expect(screen.getByText('Home')).toBeInTheDocument();
	});
});
