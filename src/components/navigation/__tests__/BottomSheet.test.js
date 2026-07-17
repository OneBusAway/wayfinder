import { render, screen, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import BottomSheet from '../BottomSheet.svelte';

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
			return { unsubscribe: () => {} };
		})
	}
}));

const headerSnippet = createRawSnippet(() => ({
	render: () => '<span>Sheet Header<button type="button">Header Action</button></span>'
}));

const bodySnippet = createRawSnippet(() => ({
	render: () => '<p>Sheet Body</p>'
}));

describe('BottomSheet', () => {
	const defaultProps = {
		header: headerSnippet,
		children: bodySnippet
	};

	test('renders header and body content', () => {
		render(BottomSheet, { props: defaultProps });

		expect(screen.getByText('Sheet Header')).toBeInTheDocument();
		expect(screen.getByText('Sheet Body')).toBeInTheDocument();
	});

	test('renders an accessible resize handle at the default half snap point', () => {
		render(BottomSheet, { props: defaultProps });

		const handle = screen.getByRole('slider', { name: 'sheet.resize_handle' });
		expect(handle).toHaveAttribute('aria-valuemin', '0');
		expect(handle).toHaveAttribute('aria-valuemax', '2');
		expect(handle).toHaveAttribute('aria-valuenow', '1');
		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_half');
	});

	test('honors the snap prop', () => {
		render(BottomSheet, { props: { ...defaultProps, snap: 'peek' } });

		expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'sheet.snap_peek');
	});

	test('follows snap prop updates after mount', async () => {
		const { rerender } = render(BottomSheet, { props: defaultProps });

		expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'sheet.snap_half');

		await rerender({ snap: 'peek' });

		expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'sheet.snap_peek');
	});

	test('arrow keys cycle through snap points and clamp at the ends', async () => {
		const user = userEvent.setup();
		render(BottomSheet, { props: defaultProps });

		const handle = screen.getByRole('slider');
		handle.focus();

		await user.keyboard('{ArrowUp}');
		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_full');

		// Already at full; ArrowUp clamps
		await user.keyboard('{ArrowUp}');
		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_full');

		await user.keyboard('{ArrowDown}');
		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_half');

		await user.keyboard('{ArrowDown}');
		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_peek');

		// Already at peek; ArrowDown clamps
		await user.keyboard('{ArrowDown}');
		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_peek');
	});

	test('Home and End jump to peek and full', async () => {
		const user = userEvent.setup();
		render(BottomSheet, { props: defaultProps });

		const handle = screen.getByRole('slider');
		handle.focus();

		await user.keyboard('{End}');
		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_full');

		await user.keyboard('{Home}');
		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_peek');
	});

	test('pointerdown on the grab handle starts a drag', async () => {
		render(BottomSheet, { props: defaultProps });

		const sheet = screen.getByTestId('bottom-sheet');
		expect(sheet.style.transition).not.toBe('none');

		// The grabber is inside the handle row, so the pointerdown bubbles to the
		// row's drag handler.
		await fireEvent.pointerDown(screen.getByRole('slider'));

		expect(sheet.style.transition).toBe('none');
	});

	test('dragging clamps the height and commits the nearest snap point on release', async () => {
		render(BottomSheet, { props: defaultProps });

		const sheet = screen.getByTestId('bottom-sheet');
		const handle = screen.getByRole('slider');

		// jsdom reports containerHeight = 0, so snapHeights are { peek: 150,
		// half: 0, full: 0 } and every drag height clamps to MIN_DRAG_HEIGHT
		// (120), whose nearest snap is deterministically 'peek'.
		await fireEvent.pointerDown(handle, { clientY: 400 });
		await fireEvent.pointerMove(handle, { clientY: 300 });
		await fireEvent.pointerUp(handle);

		expect(handle).toHaveAttribute('aria-valuetext', 'sheet.snap_peek');
		expect(handle).toHaveAttribute('aria-valuenow', '0');
		// The drag ended, so the snap transition is restored.
		expect(sheet.style.transition).not.toBe('none');
	});

	test('pointerdown on a header control does not start a drag', async () => {
		render(BottomSheet, { props: defaultProps });

		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Header Action' }));

		// The sheet keeps its snap animation: no drag was engaged, so taps on
		// header controls stay clicks instead of being captured by the drag.
		expect(screen.getByTestId('bottom-sheet').style.transition).not.toBe('none');
	});
});
