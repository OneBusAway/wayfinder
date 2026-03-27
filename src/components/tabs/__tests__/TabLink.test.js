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

	it('renders a semantic link regardless of current state', async () => {
		const { rerender } = render(TabLink, {
			props: {
				href: '/stops/1_123',
				current: false,
				children: tabLabelSnippet
			}
		});

		const link = screen.getByRole('link', { name: 'Arrivals tab' });
		expect(link).toHaveAttribute('href', '/stops/1_123');

		await rerender({ current: true });

		expect(link).toHaveAttribute('href', '/stops/1_123');
	});

	it('applies the href prop to the anchor', () => {
		render(TabLink, {
			props: {
				href: '/stops/1_123/schedule',
				current: false,
				children: tabLabelSnippet
			}
		});

		expect(screen.getByRole('link', { name: 'Arrivals tab' })).toHaveAttribute(
			'href',
			'/stops/1_123/schedule'
		);
	});
});
