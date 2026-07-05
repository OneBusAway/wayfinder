import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/** @typedef {'error' | 'warning'} NotificationVariant */

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} message
 * @property {NotificationVariant} variant
 * @property {(() => void) | null} onRetry
 */

const DEFAULT_AUTO_DISMISS_MS = 8000;

function createNotificationStore() {
	/** @type {import('svelte/store').Writable<Notification | null>} */
	const { subscribe, set } = writable(null);

	let autoDismissTimer = null;

	function clearAutoDismiss() {
		if (autoDismissTimer !== null) {
			clearTimeout(autoDismissTimer);
			autoDismissTimer = null;
		}
	}

	return {
		subscribe,

		/**
		 * Show a toast notification. Retriable errors omit auto-dismiss so the
		 * user can tap Retry; warnings auto-dismiss after a few seconds.
		 *
		 * @param {Object} options
		 * @param {string} options.message
		 * @param {NotificationVariant} [options.variant]
		 * @param {(() => void) | null} [options.onRetry]
		 * @param {number | null} [options.duration] - Ms until auto-dismiss; null keeps it open
		 */
		show: ({ message, variant = 'error', onRetry = null, duration = undefined }) => {
			if (!browser) return;

			clearAutoDismiss();

			const notification = {
				id: crypto.randomUUID(),
				message,
				variant,
				onRetry
			};

			set(notification);

			const dismissAfter =
				duration !== undefined ? duration : onRetry ? null : DEFAULT_AUTO_DISMISS_MS;

			if (dismissAfter !== null) {
				autoDismissTimer = setTimeout(() => {
					autoDismissTimer = null;
					set(null);
				}, dismissAfter);
			}
		},

		dismiss: () => {
			clearAutoDismiss();
			set(null);
		}
	};
}

export const notifications = createNotificationStore();
