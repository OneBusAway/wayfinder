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
			id: expect.any(String),
			message: 'Something failed',
			variant: 'error',
			onRetry: null
		});
	});

	it('auto-dismisses warnings after the default duration', () => {
		notifications.show({ message: 'Partial shape', variant: 'warning' });

		expect(get(notifications)).not.toBeNull();
		vi.advanceTimersByTime(8000);
		expect(get(notifications)).toBeNull();
	});

	it('keeps retriable errors visible until dismissed', () => {
		const onRetry = vi.fn();
		notifications.show({ message: 'Load failed', variant: 'error', onRetry });

		vi.advanceTimersByTime(30000);
		expect(get(notifications)).not.toBeNull();
	});

	it('dismiss clears the active notification', () => {
		notifications.show({ message: 'Load failed', variant: 'error' });
		notifications.dismiss();
		expect(get(notifications)).toBeNull();
	});
});
