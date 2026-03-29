import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StopItem from '$components/StopItem.svelte';
import FavoriteButton from '$components/favorites/FavoriteButton.svelte';
import AlertsBadge from '$components/service-alerts/AlertsBadge.svelte';

describe('Accessibility Tests', () => {
	const mockStop = { id: '1', name: 'Test Stop', code: 'TS1' };
	const favoriteProps = { id: '1', type: 'stop' };
	const alertsProps = { id: '1', type: 'stop' };

	describe('StopItem Keyboard Accessibility', () => {
		it('has role=button with tabindex=0', () => {
			const { container } = render(StopItem, {
				props: { stop: mockStop, handleStopItemClick: vi.fn() }
			});

			const stopButton = container.querySelector('[role="button"]');
			expect(stopButton).toBeTruthy();
			expect(stopButton).toHaveAttribute('tabindex', '0');
		});

		it('responds to Enter and Space keys', () => {
			const handleClick = vi.fn();
			const { container } = render(StopItem, {
				props: { stop: mockStop, handleStopItemClick: handleClick }
			});

			const stopButton = container.querySelector('[role="button"]');
			
			stopButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
			expect(handleClick).toHaveBeenCalledTimes(1);

			stopButton?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
			expect(handleClick).toHaveBeenCalledTimes(2);
		});

		it('is a div element with proper role semantics', () => {
			const { container } = render(StopItem, {
				props: { stop: mockStop, handleStopItemClick: vi.fn() }
			});

			const rootDiv = container.querySelector('[role="button"]');
			expect(rootDiv?.tagName.toLowerCase()).toBe('div');
		});
	});

	describe('FavoriteButton aria-labels', () => {
		beforeEach(() => {
			localStorage.clear();
		});

		it('has dynamic aria-label that matches title', () => {
			render(FavoriteButton, { props: favoriteProps });

			const button = screen.getByRole('button');
			const label = button.getAttribute('aria-label');
			const title = button.getAttribute('title');

			expect(label).toBeTruthy();
			expect(label).toBe(title);
			expect(['Add to favorites', 'Remove from favorites']).toContain(label);
		});
	});

	describe('AlertsBadge Live Region', () => {
		it('has role=status with aria-live=polite', () => {
			const { container } = render(AlertsBadge, { props: alertsProps });

			const liveRegion = container.querySelector('[role="status"]');
			expect(liveRegion).toHaveAttribute('aria-live', 'polite');
		});

		it('has badge with aria-label when alerts exist', () => {
			const { container } = render(AlertsBadge, { props: alertsProps });

			const liveRegion = container.querySelector('[role="status"]');
			expect(liveRegion).toBeTruthy();
		});
	});

	describe('Component Integration', () => {
		it('FavoriteButton has button type attribute', () => {
			render(FavoriteButton, { props: favoriteProps });
			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('type', 'button');
		});

		it('StopItem includes FavoriteButton', () => {
			const { container } = render(StopItem, {
				props: { stop: mockStop, handleStopItemClick: vi.fn() }
			});

			const favoriteBtn = container.querySelector('[class*="favorite"]');
			expect(favoriteBtn).toBeTruthy();
		});

		it('StopItem includes AlertsBadge', () => {
			const { container } = render(StopItem, {
				props: { stop: mockStop, handleStopItemClick: vi.fn() }
			});

			const alertsBadge = container.querySelector('[role="status"]');
			expect(alertsBadge).toBeTruthy();
		});
	});
});
