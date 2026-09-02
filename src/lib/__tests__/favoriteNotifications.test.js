import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { notifications } from '$stores/notificationStore';
import { notifyFavoriteSaved, notifyFavoriteRemoved } from '../favoriteNotifications';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => {
				const messages = {
					'notifications.favorite_saved': 'Saved to favorites.',
					'notifications.favorite_removed': 'Removed from favorites.'
				};
				return messages[key] ?? key;
			});
			return () => {};
		})
	}
}));

describe('favoriteNotifications', () => {
	beforeEach(() => {
		notifications.dismiss();
	});

	afterEach(() => {
		notifications.dismiss();
	});

	it('notifyFavoriteSaved shows a short success toast', () => {
		const id = notifyFavoriteSaved();

		const active = get(notifications);
		expect(id).toBe(active.id);
		expect(active.variant).toBe('success');
		expect(active.message).toBe('Saved to favorites.');
		expect(active.onRetry).toBeNull();
	});

	it('notifyFavoriteRemoved shows a short success toast', () => {
		notifyFavoriteRemoved();

		const active = get(notifications);
		expect(active.variant).toBe('success');
		expect(active.message).toBe('Removed from favorites.');
	});
});
