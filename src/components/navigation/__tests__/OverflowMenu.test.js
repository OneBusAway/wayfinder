import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import OverflowMenu from '../OverflowMenu.svelte';

describe('OverflowMenu', () => {
	const mockLinks = [
		{ key: 'About', value: '/about' },
		{ key: 'Contact', value: '/contact' },
		{ key: 'GitHub', value: 'https://github.com/OneBusAway' }
	];

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('renders all navigation links with correct text and href', () => {
		const onClose = vi.fn();
		render(OverflowMenu, { links: mockLinks, onClose });

		mockLinks.forEach(({ key, value }) => {
			const link = screen.getByRole('link', { name: key });
			expect(link).toBeInTheDocument();
			expect(link).toHaveAttribute('href', value);
		});
	});

	test('renders empty menu when no links are provided', () => {
		const onClose = vi.fn();
		render(OverflowMenu, { links: [], onClose });

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});

	test('calls onClose when a link is clicked', async () => {
		const onClose = vi.fn();
		render(OverflowMenu, { links: mockLinks, onClose });

		const firstLink = screen.getByRole('link', { name: 'About' });
		await fireEvent.click(firstLink);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test('calls onClose when clicking outside the menu', async () => {
		const onClose = vi.fn();
		render(OverflowMenu, { links: mockLinks, onClose });

		// Advance timers so the setTimeout for outside click listener runs
		vi.runAllTimers();

		// Click outside on document body
		await fireEvent.click(document.body);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test('does not call onClose when clicking inside the menu container', async () => {
		const onClose = vi.fn();
		const { container } = render(OverflowMenu, { links: mockLinks, onClose });

		vi.runAllTimers();

		const menuContainer = container.firstElementChild;
		await fireEvent.click(menuContainer);

		expect(onClose).not.toHaveBeenCalled();
	});

	test('cleans up click listener and timeout on unmount', () => {
		const onClose = vi.fn();
		const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

		const { unmount } = render(OverflowMenu, { links: mockLinks, onClose });
		vi.runAllTimers();

		unmount();

		expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
		removeEventListenerSpy.mockRestore();
	});

	test('updates rendered links when the links prop changes', async () => {
		const onClose = vi.fn();
		const { rerender } = render(OverflowMenu, { links: mockLinks, onClose });

		expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();

		await rerender({ links: [{ key: 'Home', value: '/' }], onClose });

		expect(screen.queryByRole('link', { name: 'About' })).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
	});
});
