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
		expect(handle).toHaveAttribute('aria-valuetext', 'half');
	});

	test('honors the snap prop', () => {
		render(BottomSheet, { props: { ...defaultProps, snap: 'peek' } });

		expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', 'peek');
	});

	test('arrow keys cycle through snap points and clamp at the ends', async () => {
		const user = userEvent.setup();
		render(BottomSheet, { props: defaultProps });

		const handle = screen.getByRole('slider');
		handle.focus();

		await user.keyboard('{ArrowUp}');
		expect(handle).toHaveAttribute('aria-valuetext', 'full');

		// Already at full; ArrowUp clamps
		await user.keyboard('{ArrowUp}');
		expect(handle).toHaveAttribute('aria-valuetext', 'full');

		await user.keyboard('{ArrowDown}');
		expect(handle).toHaveAttribute('aria-valuetext', 'half');

		await user.keyboard('{ArrowDown}');
		expect(handle).toHaveAttribute('aria-valuetext', 'peek');

		// Already at peek; ArrowDown clamps
		await user.keyboard('{ArrowDown}');
		expect(handle).toHaveAttribute('aria-valuetext', 'peek');
	});

	test('Home and End jump to peek and full', async () => {
		const user = userEvent.setup();
		render(BottomSheet, { props: defaultProps });

		const handle = screen.getByRole('slider');
		handle.focus();

		await user.keyboard('{End}');
		expect(handle).toHaveAttribute('aria-valuetext', 'full');

		await user.keyboard('{Home}');
		expect(handle).toHaveAttribute('aria-valuetext', 'peek');
	});

	test('dims the map only at the full snap point', async () => {
		const user = userEvent.setup();
		render(BottomSheet, { props: defaultProps });

		const dim = screen.getByTestId('map-dim');
		expect(dim).not.toHaveClass('bg-gray-900/[.28]');

		const handle = screen.getByRole('slider');
		handle.focus();
		await user.keyboard('{End}');

		expect(dim).toHaveClass('bg-gray-900/[.28]');
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

	test('pointerdown on a header control does not start a drag', async () => {
		render(BottomSheet, { props: defaultProps });

		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Header Action' }));

		// The sheet keeps its snap animation: no drag was engaged, so taps on
		// header controls stay clicks instead of being captured by the drag.
		expect(screen.getByTestId('bottom-sheet').style.transition).not.toBe('none');
	});

	test('never dims the map when mapDim is false', async () => {
		const user = userEvent.setup();
		render(BottomSheet, { props: { ...defaultProps, mapDim: false } });

		const handle = screen.getByRole('slider');
		handle.focus();
		await user.keyboard('{End}');

		expect(screen.getByTestId('map-dim')).not.toHaveClass('bg-gray-900/[.28]');
	});
});
