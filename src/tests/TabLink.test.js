import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import TabLink from '$components/tabs/TabLink.svelte';

const tabLabelSnippet = createRawSnippet(() => ({
	render: () => 'Arrivals tab'
}));

describe('TabLink', () => {
	it('renders the label from children snippet', () => {
		render(TabLink, {
			props: {
				href: '/stops/1_123',
				current: false,
				children: tabLabelSnippet
			}
		});

		expect(screen.getByText('Arrivals tab')).toBeInTheDocument();
	});

	it('reflects current state in aria-selected', async () => {
		const { rerender } = render(TabLink, {
			props: {
				href: '/stops/1_123',
				current: false,
				children: tabLabelSnippet
			}
		});

		const tab = screen.getByRole('tab');
		expect(tab).toHaveAttribute('aria-selected', 'false');

		await rerender({ current: true });

		expect(tab).toHaveAttribute('aria-selected', 'true');
	});

	it('applies the href prop to the anchor', () => {
		render(TabLink, {
			props: {
				href: '/stops/1_123/schedule',
				current: false,
				children: tabLabelSnippet
			}
		});

		expect(screen.getByRole('tab')).toHaveAttribute('href', '/stops/1_123/schedule');
	});
});
