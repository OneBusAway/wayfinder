import { get } from 'svelte/store';
import { t } from 'svelte-i18n';
import { notifications } from '$stores/notificationStore';

/**
 * Surfaces a total route-load failure with an optional retry action.
 *
 * @param {() => void} [onRetry]
 * @returns {number | null} the notification's id, for a scoped dismiss
 */
export function notifyRouteLoadFailed(onRetry) {
	return notifications.show({
		message: get(t)('notifications.route_load_failed'),
		variant: 'error',
		onRetry: onRetry ?? null
	});
}

/**
 * Surfaces a route whose shape couldn't be drawn at all — the stops and
 * vehicles are on the map but the route line is missing entirely.
 *
 * @param {() => void} [onRetry]
 * @returns {number | null} the notification's id, for a scoped dismiss
 */
export function notifyRouteShapeFailed(onRetry) {
	return notifications.show({
		message: get(t)('notifications.route_shape_failed'),
		variant: 'error',
		onRetry: onRetry ?? null
	});
}

/**
 * Surfaces a partial route shape decode (some segments missing on the map).
 *
 * @returns {number | null} the notification's id, for a scoped dismiss
 */
export function notifyPartialRouteShape() {
	return notifications.show({
		message: get(t)('notifications.route_shape_partial'),
		variant: 'warning',
		duration: 6000
	});
}
