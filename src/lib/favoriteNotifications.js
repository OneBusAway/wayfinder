import { get } from 'svelte/store';
import { t } from 'svelte-i18n';
import { notifications } from '$stores/notificationStore';

const FAVORITE_TOAST_MS = 3000;

/**
 * Confirm a stop or route was saved to favorites.
 * @returns {number | null}
 */
export function notifyFavoriteSaved() {
	return notifications.show({
		message: get(t)('notifications.favorite_saved'),
		variant: 'success',
		duration: FAVORITE_TOAST_MS
	});
}

/**
 * Confirm a stop or route was removed from favorites.
 * @returns {number | null}
 */
export function notifyFavoriteRemoved() {
	return notifications.show({
		message: get(t)('notifications.favorite_removed'),
		variant: 'success',
		duration: FAVORITE_TOAST_MS
	});
}
