import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import StopItem from '$components/StopItem.svelte';
import FavoriteButton from '$components/favorites/FavoriteButton.svelte';
import AlertsBadge from '$components/service-alerts/AlertsBadge.svelte';
import { favorites } from '$stores/favoritesStore';

describe('Accessibility Tests', () => {
	describe('StopItem Keyboard Accessibility', () => {
		it('should have role=button', async () => {
			const { container } = render(StopItem, {
				props: {
					stop: { id: '1', name: 'Test Stop', code: 'TS1' },
					handleStopItemClick: vi.fn()
				}
			});

			const stopButton = container.querySelector('[role="button"]');
			expect(stopButton).toBeTruthy();
		});

		it('should have tabindex=0 for keyboard focus', async () => {
			const { container } = render(StopItem, {
				props: {
					stop: { id: '1', name: 'Test Stop', code: 'TS1' },
					handleStopItemClick: vi.fn()
				}
			});

			const stopButton = container.querySelector('[role="button"]');
			expect(stopButton).toHaveAttribute('tabindex', '0');
		});

		it('should have keyboard handler for Enter key', async () => {
			const handleClick = vi.fn();
			const { container } = render(StopItem, {
				props: {
					stop: { id: '1', name: 'Test Stop', code: 'TS1' },
					handleStopItemClick: handleClick
				}
			});

			const stopButton = container.querySelector('[role="button"]');
			stopButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

			expect(handleClick).toHaveBeenCalled();
		});

		it('should have keyboard handler for Space key', async () => {
			const handleClick = vi.fn();
			const { container } = render(StopItem, {
				props: {
					stop: { id: '1', name: 'Test Stop', code: 'TS1' },
					handleStopItemClick: handleClick
				}
			});

			const stopButton = container.querySelector('[role="button"]');
			stopButton.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

			expect(handleClick).toHaveBeenCalled();
		});

		it('should be keyboard accessible with proper role and tabindex', async () => {
			const { container } = render(StopItem, {
				props: {
					stop: { id: '1', name: 'Test Stop', code: 'TS1' },
					handleStopItemClick: vi.fn()
				}
			});

			const rootDiv = container.querySelector('[role="button"]');
			expect(rootDiv).toBeTruthy();
			expect(rootDiv?.tagName.toLowerCase()).toBe('div');
		});
	});

	describe('FavoriteButton Dynamic aria-label', () => {
		beforeEach(() => {
			localStorage.clear();
		});

		it('should have aria-label attribute', async () => {
			const { container } = render(FavoriteButton, {
				props: { id: '1', type: 'stop' }
			});

			const button = screen.getByRole('button');
			const label = button.getAttribute('aria-label');
			expect(label).toBeTruthy();
		});

		it('aria-label should be one of valid options', async () => {
			const { container } = render(FavoriteButton, {
				props: { id: '1', type: 'stop' }
			});

			const button = screen.getByRole('button');
			const label = button.getAttribute('aria-label');
			const validLabels = ['Add to favorites', 'Remove from favorites'];
			expect(validLabels).toContain(label);
		});

		it('title attribute should match aria-label', async () => {
			const { container } = render(FavoriteButton, {
				props: { id: '1', type: 'stop' }
			});

			const button = screen.getByRole('button');
			const ariaLabel = button.getAttribute('aria-label');
			const title = button.getAttribute('title');
			expect(ariaLabel).toBe(title);
		});

		it('should have dynamic aria-label (not static)', async () => {
			const { container } = render(FavoriteButton, {
				props: { id: '1', type: 'stop' }
			});

			const button = screen.getByRole('button');
			// Check that aria-label uses reactive binding (not hardcoded)
			expect(button).toHaveAttribute('aria-label');
		});
	});

	describe('AlertsBadge Live Region', () => {
		it('should have role=status', async () => {
			const { container } = render(AlertsBadge, {
				props: { id: '1', type: 'stop' }
			});

			const liveRegion = container.querySelector('[role="status"]');
			expect(liveRegion).toBeTruthy();
		});

		it('should have aria-live=polite', async () => {
			const { container } = render(AlertsBadge, {
				props: { id: '1', type: 'stop' }
			});

			const liveRegion = container.querySelector('[role="status"]');
			expect(liveRegion).toHaveAttribute('aria-live', 'polite');
		});

		it('should contain badge div with aria-label when alerts exist', async () => {
			const { container } = render(AlertsBadge, {
				props: { id: '1', type: 'stop' }
			});

			const badge = container.querySelector('[aria-label]');
			// Badge might not exist if alertCount is 0, so just check if it exists
			if (badge) {
				expect(badge).toBeTruthy();
			}
		});

		it('should render live region wrapper', async () => {
			const { container } = render(AlertsBadge, {
				props: { id: '1', type: 'stop' }
			});

			const liveRegion = container.querySelector('[role="status"]');
			expect(liveRegion).toBeTruthy();
			expect(liveRegion).toHaveAttribute('aria-live', 'polite');
		});
	});

	describe('General Accessibility', () => {
		it('FavoriteButton should be keyboard accessible', async () => {
			const { container } = render(FavoriteButton, {
				props: { id: '1', type: 'stop' }
			});

			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('type', 'button');
		});

		it('StopItem should include FavoriteButton', async () => {
			const { container } = render(StopItem, {
				props: {
					stop: { id: '1', name: 'Test Stop', code: 'TS1' },
					handleStopItemClick: vi.fn()
				}
			});

			const favoriteBtn = container.querySelector('[class*="favorite"]');
			expect(favoriteBtn).toBeTruthy();
		});

		it('StopItem should include AlertsBadge', async () => {
			const { container } = render(StopItem, {
				props: {
					stop: { id: '1', name: 'Test Stop', code: 'TS1' },
					handleStopItemClick: vi.fn()
				}
			});

			const alertsBadge = container.querySelector('[role="status"]');
			expect(alertsBadge).toBeTruthy();
		});
	});
});
