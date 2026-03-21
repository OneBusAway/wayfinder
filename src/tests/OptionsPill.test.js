import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OptionsPill from '$components/trip-planner/OptionsPill.svelte';

describe('OptionsPill', () => {
	it('renders the label', () => {
		render(OptionsPill, { props: { label: 'Fewest transfers' } });

		expect(screen.getByText('Fewest transfers')).toBeInTheDocument();
	});

	it('fires click when clicked', async () => {
		const user = userEvent.setup();
		const onclick = vi.fn();

		render(OptionsPill, { props: { label: 'Options', onclick } });

		await user.click(screen.getByRole('button', { name: 'Options' }));

		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('applies active styling when active and inactive styling when not', async () => {
		const { rerender, container } = render(OptionsPill, {
			props: { label: 'Walk', active: false }
		});

		let pill = container.querySelector('span');
		expect(pill).toBeTruthy();
		expect(pill).not.toHaveClass('options-pill--active');

		await rerender({ label: 'Walk', active: true });

		pill = container.querySelector('span');
		expect(pill).toHaveClass('options-pill--active');
	});
});
