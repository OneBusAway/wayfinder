import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { notifications } from '../notificationStore';

vi.mock('$app/environment', () => ({
	browser: true
}));

describe('notificationStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		notifications.dismiss();
	});

	afterEach(() => {
		notifications.dismiss();
		vi.useRealTimers();
	});

	it('shows a notification with message and variant', () => {
		notifications.show({ message: 'Something failed', variant: 'error' });

		expect(get(notifications)).toEqual({
			id: expect.any(Number),
			message: 'Something failed',
			variant: 'error',
			onRetry: null
		});
	});

	it('returns the id of the notification it showed', () => {
		const id = notifications.show({ message: 'Load failed', variant: 'error' });

		expect(id).toBe(get(notifications).id);
	});

	it('auto-dismisses warnings after the default duration', () => {
		notifications.show({ message: 'Partial shape', variant: 'warning' });

		expect(get(notifications)).not.toBeNull();
		vi.advanceTimersByTime(8000);
		expect(get(notifications)).toBeNull();
	});

	it('keeps retriable errors visible long enough to act on, then expires them', () => {
		const onRetry = vi.fn();
		notifications.show({ message: 'Load failed', variant: 'error', onRetry });

		// Well past the warning duration, so the retry affordance is still there...
		vi.advanceTimersByTime(19000);
		expect(get(notifications)).not.toBeNull();

		// ...but it doesn't sit on top of the bottom-anchored UI forever.
		vi.advanceTimersByTime(1000);
		expect(get(notifications)).toBeNull();
	});

	it('dismiss clears the active notification', () => {
		notifications.show({ message: 'Load failed', variant: 'error' });
		notifications.dismiss();
		expect(get(notifications)).toBeNull();
	});

	it('dismiss with an id only clears that notification', () => {
		const stale = notifications.show({ message: 'First', variant: 'error' });
		notifications.dismiss();
		const current = notifications.show({ message: 'Second', variant: 'error' });

		notifications.dismiss(stale);
		expect(get(notifications)?.message).toBe('Second');

		notifications.dismiss(current);
		expect(get(notifications)).toBeNull();
	});

	it('dismiss with a null id (nothing was ever shown) clears nothing', () => {
		notifications.show({ message: 'Someone else caused this', variant: 'error' });

		notifications.dismiss(null);

		expect(get(notifications)?.message).toBe('Someone else caused this');
	});

	it('does not let a warning clobber a retriable error', () => {
		const onRetry = vi.fn();
		notifications.show({ message: 'Load failed', variant: 'error', onRetry });

		const suppressed = notifications.show({ message: 'Partial shape', variant: 'warning' });

		expect(suppressed).toBeNull();
		expect(get(notifications)?.message).toBe('Load failed');

		// The retry affordance still works, and its timer wasn't reset by the
		// suppressed call.
		get(notifications).onRetry();
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it('lets a new retriable error replace an existing one', () => {
		notifications.show({ message: 'First route failed', variant: 'error', onRetry: vi.fn() });
		notifications.show({ message: 'Second route failed', variant: 'error', onRetry: vi.fn() });

		expect(get(notifications)?.message).toBe('Second route failed');
	});
});
