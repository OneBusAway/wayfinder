import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

/** @typedef {'error' | 'warning' | 'success'} NotificationVariant */

/**
 * @typedef {Object} Notification
 * @property {number} id
 * @property {string} message
 * @property {NotificationVariant} variant
 * @property {(() => void) | null} onRetry
 */

const DEFAULT_AUTO_DISMISS_MS = 8000;
// Retriable errors stay up long enough to be read and acted on, but still
// expire: the toast is bottom-anchored and interactive, so a permanent one
// would sit on top of the stop sheet / trip planner controls indefinitely.
const RETRIABLE_AUTO_DISMISS_MS = 20000;

function createNotificationStore() {
	/** @type {import('svelte/store').Writable<Notification | null>} */
	const { subscribe, set } = writable(null);

	let autoDismissTimer = null;
	let nextId = 0;

	function clearAutoDismiss() {
		if (autoDismissTimer !== null) {
			clearTimeout(autoDismissTimer);
			autoDismissTimer = null;
		}
	}

	return {
		subscribe,

		/**
		 * Show a toast notification and return its id, or null if nothing was
		 * shown. Pass the id back to `dismiss` so a component only ever clears
		 * the notification it raised.
		 *
		 * A retriable error outranks a plain one: while a retry affordance is on
		 * screen an incoming non-retriable notification is dropped rather than
		 * clobbering the slot, so a background warning can't destroy the only
		 * way the user has to recover from a failed load.
		 *
		 * @param {Object} options
		 * @param {string} options.message
		 * @param {NotificationVariant} [options.variant]
		 * @param {(() => void) | null} [options.onRetry]
		 * @param {number | null} [options.duration] - Ms until auto-dismiss; null keeps it open
		 * @returns {number | null} the new notification's id
		 */
		show: ({ message, variant = 'error', onRetry = null, duration = undefined }) => {
			if (!browser) return null;

			const current = get({ subscribe });
			if (current?.onRetry && !onRetry) return null;

			clearAutoDismiss();

			const notification = {
				id: ++nextId,
				message,
				variant,
				onRetry
			};

			set(notification);

			const dismissAfter =
				duration !== undefined
					? duration
					: onRetry
						? RETRIABLE_AUTO_DISMISS_MS
						: DEFAULT_AUTO_DISMISS_MS;

			if (dismissAfter !== null) {
				autoDismissTimer = setTimeout(() => {
					autoDismissTimer = null;
					set(null);
				}, dismissAfter);
			}

			return notification.id;
		},

		/**
		 * Clear the current notification. Pass the id returned by `show` to clear
		 * it only if it's still the one on screen; omit the id to clear whatever
		 * is showing (user-initiated dismissal).
		 *
		 * @param {number | null} [id]
		 */
		dismiss: (id = undefined) => {
			if (id !== undefined) {
				const current = get({ subscribe });
				if (!current || current.id !== id) return;
			}
			clearAutoDismiss();
			set(null);
		}
	};
}

export const notifications = createNotificationStore();
