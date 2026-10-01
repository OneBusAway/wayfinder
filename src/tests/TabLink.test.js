import { render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';
import TabLink from '../components/tabs/TabLink.svelte';
import TabLinkFixture from './fixtures/TabLinkFixture.svelte';

describe('TabLink', () => {
	test('renders child content and the destination with an inactive tab by default', () => {
		render(TabLinkFixture);

		const link = screen.getByRole('link', { name: 'Stops' });
		expect(link).toHaveAttribute('href', '/stops');
		expect(link.parentElement).toHaveClass('tab-container__item');
		expect(link.parentElement).not.toHaveClass('tab-container__item--active');
	});

	test('renders an active tab when current is true', () => {
		render(TabLinkFixture, { props: { current: true } });

		expect(screen.getByRole('link', { name: 'Stops' }).parentElement).toHaveClass(
			'tab-container__item--active'
		);
	});

	test('adds and removes the active class when current changes', async () => {
		const { rerender } = render(TabLinkFixture);
		const link = screen.getByRole('link', { name: 'Stops' });

		await rerender({ current: true });
		expect(link.parentElement).toHaveClass('tab-container__item--active');

		await rerender({ current: false });
		expect(link.parentElement).not.toHaveClass('tab-container__item--active');
	});

	test('updates the destination and child content when props change', async () => {
		const { rerender } = render(TabLinkFixture);

		await rerender({ href: '/routes', label: 'Routes' });

		expect(screen.getByRole('link', { name: 'Routes' })).toHaveAttribute('href', '/routes');
		expect(screen.queryByRole('link', { name: 'Stops' })).not.toBeInTheDocument();
	});

	test('renders without optional child content', () => {
		render(TabLink, { props: { href: '/stops' } });

		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', '/stops');
		expect(link).toBeEmptyDOMElement();
	});
});
