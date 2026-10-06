import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { navigating } from '$app/stores';
import TabLink from '../components/tabs/TabLink.svelte';
import TabLinkFixture from './fixtures/TabLinkFixture.svelte';

vi.mock('$app/stores', async () => {
	const { writable } = await import('svelte/store');
	return { navigating: writable(null) };
});

function navigateTo(path) {
	navigating.set({ to: { url: new URL(path, 'http://localhost:5173') } });
}

describe('TabLink', () => {
	afterEach(() => {
		navigating.set(null);
	});

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

	test('shows a loading bar while navigating to its page', () => {
		navigateTo('/stops');
		render(TabLinkFixture);

		const link = screen.getByRole('link', { name: 'Stops' });
		expect(link).toHaveAttribute('aria-busy', 'true');
		expect(link.parentElement).toHaveClass('tab-container__item--pending');
	});

	test('stays idle while navigating to another page', () => {
		navigateTo('/routes');
		render(TabLinkFixture);

		const link = screen.getByRole('link', { name: 'Stops' });
		expect(link.parentElement).not.toHaveClass('tab-container__item--pending');
	});

	test('matches the destination by path, ignoring its query and hash', () => {
		navigateTo('/stops?date=2026-10-05#top');
		render(TabLinkFixture);

		expect(screen.getByRole('link', { name: 'Stops' })).toHaveAttribute('aria-busy', 'true');
	});

	test('removes the loading bar once navigation finishes', async () => {
		navigateTo('/stops');
		render(TabLinkFixture);
		const link = screen.getByRole('link', { name: 'Stops' });

		navigating.set(null);
		await tick();

		expect(link.parentElement).not.toHaveClass('tab-container__item--pending');
	});
});
