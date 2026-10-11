import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import SingleSelectAccordionFixture from './SingleSelectAccordionFixture.svelte';

describe('SingleSelectAccordion', () => {
	let animate;

	beforeEach(() => {
		animate = Element.prototype.animate;
		Element.prototype.animate = vi.fn(() => {
			const animation = { cancel: vi.fn(), currentTime: 0, onfinish: null };
			queueMicrotask(() => animation.onfinish?.());
			return animation;
		});
	});

	test('forwards payloads and clears them when the same item is toggled off', async () => {
		const handleAccordionSelectionChanged = vi.fn();
		render(SingleSelectAccordionFixture, {
			props: { showItem: true, handleAccordionSelectionChanged }
		});

		const button = screen.getByRole('button', { name: 'Active trip' });
		expect(button).toHaveAttribute('aria-expanded', 'false');
		expect(screen.getByTestId('active-header')).not.toHaveClass('active');
		await fireEvent.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByTestId('active-header')).toHaveClass('active');
		expect(screen.getByText('Trip details')).toBeInTheDocument();
		expect(handleAccordionSelectionChanged).toHaveBeenLastCalledWith({
			activeItem: expect.any(String),
			activeData: { tripId: 'active-trip' }
		});

		await fireEvent.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'false');
		expect(screen.getByTestId('active-header')).not.toHaveClass('active');
		expect(handleAccordionSelectionChanged).toHaveBeenLastCalledWith({
			activeItem: null,
			activeData: null
		});
	});

	test('switches to an item with the default null payload', async () => {
		const handleAccordionSelectionChanged = vi.fn();
		render(SingleSelectAccordionFixture, {
			props: { showItem: true, showSecondItem: true, handleAccordionSelectionChanged }
		});

		const first = screen.getByRole('button', { name: 'Active trip' });
		const second = screen.getByRole('button', { name: 'Other item' });
		await fireEvent.click(first);
		const firstId = handleAccordionSelectionChanged.mock.lastCall[0].activeItem;
		await fireEvent.click(second);
		expect(first).toHaveAttribute('aria-expanded', 'false');
		expect(second).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByTestId('second-header')).toHaveClass('active');
		expect(handleAccordionSelectionChanged).toHaveBeenLastCalledWith({
			activeItem: expect.any(String),
			activeData: null
		});
		expect(handleAccordionSelectionChanged.mock.lastCall[0].activeItem).not.toBe(firstId);
	});

	afterEach(() => {
		Element.prototype.animate = animate;
	});

	test('clears the selection when the active item unmounts', async () => {
		const handleAccordionSelectionChanged = vi.fn();
		const { rerender } = render(SingleSelectAccordionFixture, {
			props: { showItem: true, handleAccordionSelectionChanged }
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Active trip' }));
		await tick();
		expect(handleAccordionSelectionChanged).toHaveBeenLastCalledWith({
			activeItem: expect.any(String),
			activeData: { tripId: 'active-trip' }
		});

		await rerender({ showItem: false, handleAccordionSelectionChanged });
		await tick();
		expect(handleAccordionSelectionChanged).toHaveBeenLastCalledWith({
			activeItem: null,
			activeData: null
		});
	});
});
