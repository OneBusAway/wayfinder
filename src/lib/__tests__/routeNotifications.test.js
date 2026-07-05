import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { notifications } from '$stores/notificationStore';
import { notifyRouteLoadFailed, notifyPartialRouteShape } from '../routeNotifications';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => {
				const messages = {
					'notifications.route_load_failed': "Couldn't load this route.",
					'notifications.tap_to_retry': 'Tap to retry.',
					'notifications.route_shape_partial':
						"Part of this route couldn't be drawn. The map may be missing a segment."
				};
				return messages[key] ?? key;
			});
			return () => {};
		})
	}
}));

describe('routeNotifications', () => {
	beforeEach(() => {
		notifications.dismiss();
	});

	afterEach(() => {
		notifications.dismiss();
	});

	it('notifyRouteLoadFailed shows an error with retry callback', () => {
		const onRetry = vi.fn();
		notifyRouteLoadFailed(onRetry);

		const active = get(notifications);
		expect(active?.variant).toBe('error');
		expect(active?.message).toContain("Couldn't load this route");
		expect(active?.onRetry).toBe(onRetry);
	});

	it('notifyPartialRouteShape shows a warning', () => {
		notifyPartialRouteShape();

		const active = get(notifications);
		expect(active?.variant).toBe('warning');
		expect(active?.message).toContain("couldn't be drawn");
		expect(active?.onRetry).toBeNull();
	});
});
