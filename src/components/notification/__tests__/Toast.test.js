import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import Toast from '../Toast.svelte';
import { notifications } from '$stores/notificationStore';

vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('svelte-i18n', () => {
	const messages = {
		'notifications.tap_to_retry': 'Tap to retry.',
		'notifications.dismiss': 'Dismiss'
	};

	return {
		t: {
			subscribe: vi.fn((fn) => {
				fn((key) => messages[key] ?? key);
				return () => {};
			})
		}
	};
});

describe('Toast', () => {
	afterEach(() => {
		notifications.dismiss();
	});

	test('renders nothing until a notification is shown', () => {
		render(Toast);

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
	});

	test('renders an error as an assertive alert', async () => {
		render(Toast);

		notifications.show({ message: "Couldn't load this route.", variant: 'error' });

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent("Couldn't load this route.");
	});

	test('renders a warning as a polite status', async () => {
		render(Toast);

		notifications.show({ message: 'Part of this route is missing.', variant: 'warning' });

		const status = await screen.findByRole('status');
		expect(status).toHaveAttribute('aria-live', 'polite');
	});

	test('shows the retry button only when the notification is retriable', async () => {
		render(Toast);

		notifications.show({ message: 'No retry here', variant: 'warning' });
		await screen.findByRole('status');
		expect(screen.queryByRole('button', { name: 'Tap to retry.' })).not.toBeInTheDocument();

		notifications.dismiss();
		notifications.show({ message: 'Retriable', variant: 'error', onRetry: vi.fn() });
		expect(await screen.findByRole('button', { name: 'Tap to retry.' })).toBeInTheDocument();
	});

	test('retry invokes the callback and clears the toast', async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();
		render(Toast);

		notifications.show({ message: 'Load failed', variant: 'error', onRetry });
		await user.click(await screen.findByRole('button', { name: 'Tap to retry.' }));

		expect(onRetry).toHaveBeenCalledOnce();
		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
	});

	test('the dismiss button clears the toast', async () => {
		const user = userEvent.setup();
		render(Toast);

		notifications.show({ message: 'Load failed', variant: 'error', onRetry: vi.fn() });
		await screen.findByRole('alert');

		await user.click(screen.getByRole('button', { name: 'Dismiss' }));

		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
		expect(get(notifications)).toBeNull();
	});

	test('Escape dismisses a persistent toast without needing the mouse', async () => {
		const user = userEvent.setup();
		render(Toast);

		notifications.show({ message: 'Load failed', variant: 'error', onRetry: vi.fn() });
		await screen.findByRole('alert');

		await user.keyboard('{Escape}');

		await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
		expect(get(notifications)).toBeNull();
	});
});
