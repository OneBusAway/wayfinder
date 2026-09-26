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
