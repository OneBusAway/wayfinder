import { get } from 'svelte/store';
import { t } from 'svelte-i18n';
import { notifications } from '$stores/notificationStore';

/**
 * Surfaces a total route-load failure with an optional retry action.
 *
 * @param {() => void} [onRetry]
 */
export function notifyRouteLoadFailed(onRetry) {
	notifications.show({
		message: get(t)('notifications.route_load_failed'),
		variant: 'error',
		onRetry: onRetry ?? null
	});
}

/** Surfaces a partial route shape decode (some segments missing on the map). */
export function notifyPartialRouteShape() {
	notifications.show({
		message: get(t)('notifications.route_shape_partial'),
		variant: 'warning',
		duration: 6000
	});
}
