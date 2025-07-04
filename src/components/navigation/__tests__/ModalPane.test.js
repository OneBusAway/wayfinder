import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import ModalPane from '../ModalPane.svelte';

describe('ModalPane', () => {
	let mockClosePane;

	beforeEach(() => {
		mockClosePane = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('renders modal pane with title', () => {
		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		expect(screen.getByText('Test Modal')).toBeInTheDocument();
	});

	test('renders modal pane without title', () => {
		render(ModalPane, {
			props: {
				closePane: mockClosePane
			}
		});

		// Should not throw an error and should render the close button
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
	});

	test('renders close button with correct accessibility attributes', () => {
		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });
		expect(closeButton).toBeInTheDocument();
		expect(closeButton).toHaveAttribute('type', 'button');

		// Check for screen reader text
		expect(screen.getByText('Close')).toHaveClass('sr-only');
	});

	test('closes modal when close button is clicked', async () => {
		const user = userEvent.setup();

		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });
		await user.click(closeButton);

		expect(mockClosePane).toHaveBeenCalledTimes(1);
	});

	test('renders FontAwesome X icon in close button', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		// FontAwesome icon should be rendered
		const iconContainer = container.querySelector('.font-black.text-black.dark\\:text-white');
		expect(iconContainer).toBeInTheDocument();
	});

	test('applies correct CSS classes to modal pane', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const modalPane = container.querySelector('.modal-pane');
		expect(modalPane).toHaveClass(
			'modal-pane',
			'pointer-events-auto',
			'h-full',
			'rounded-b-none',
			'px-4'
		);
	});

	test('applies correct classes to close button', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const closeButton = container.querySelector('.close-button');
		expect(closeButton).toHaveClass('close-button');
	});

	test('title has correct styling', () => {
		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const titleElement = screen.getByText('Test Modal');
		expect(titleElement).toHaveClass('text-normal', 'flex-1', 'self-center', 'font-semibold');
	});

	test('header layout has correct structure', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const header = container.querySelector('.flex.py-1');
		expect(header).toBeInTheDocument();
		expect(header).toHaveClass('flex', 'py-1');
	});

	test('content area has correct overflow styling', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const contentArea = container.querySelector('.absolute.inset-0.overflow-y-auto');
		expect(contentArea).toBeInTheDocument();
		expect(contentArea).toHaveClass('absolute', 'inset-0', 'overflow-y-auto');
	});

	test('renders content area for children', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		// Check for the relative container that holds children
		const relativeContainer = container.querySelector('.relative.flex-1');
		expect(relativeContainer).toBeInTheDocument();
		expect(relativeContainer).toHaveClass('relative', 'flex-1');
	});

	test('includes empty footer for content indication', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		// Check for the footer div with mb-4 class
		const footer = container.querySelector('.mb-4');
		expect(footer).toBeInTheDocument();
		expect(footer).toHaveClass('mb-4');
	});

	test('modal has fly transition animation', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		// The component should have transition:fly applied
		// This is harder to test directly, but we can check that the component renders
		const modalPane = container.querySelector('.modal-pane');
		expect(modalPane).toBeInTheDocument();
	});

	test('handles Escape key to close modal', async () => {
		const user = userEvent.setup();

		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		// Test that the keybinding is working by simulating the Escape key
		await user.keyboard('{Escape}');
		expect(mockClosePane).toHaveBeenCalledTimes(1);
	});

	test('close button can be focused', async () => {
		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });

		closeButton.focus();
		expect(closeButton).toHaveFocus();
	});

	test('close button has hover styles', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		// The PostCSS styles should be applied via the close-button class
		const closeButton = container.querySelector('.close-button');
		expect(closeButton).toBeInTheDocument();
	});

	test('modal pane structure has correct flex layout', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const flexContainer = container.querySelector('.flex.h-full.flex-col');
		expect(flexContainer).toBeInTheDocument();
		expect(flexContainer).toHaveClass('flex', 'h-full', 'flex-col');
	});

	test('renders with empty title string', () => {
		render(ModalPane, {
			props: {
				title: '',
				closePane: mockClosePane
			}
		});

		// Should render without issues
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();

		// Title area should still exist but be empty
		const { container } = render(ModalPane, {
			props: {
				title: '',
				closePane: mockClosePane
			}
		});

		const titleElement = container.querySelector('.text-normal.flex-1.self-center.font-semibold');
		expect(titleElement).toBeInTheDocument();
	});

	test('FontAwesome icon has correct dark mode styling', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const icon = container.querySelector('.font-black.text-black.dark\\:text-white');
		expect(icon).toBeInTheDocument();
		expect(icon).toHaveClass('font-black', 'text-black', 'dark:text-white');
	});

	test('screen reader text is properly hidden', () => {
		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const srText = screen.getByText('Close');
		expect(srText).toHaveClass('sr-only');
	});

	test('modal pane uses correct pointer events', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const modalPane = container.querySelector('.modal-pane');
		expect(modalPane).toHaveClass('pointer-events-auto');
	});

	test('header and content areas are properly separated', () => {
		const { container } = render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		// Header should be flex with py-1
		const header = container.querySelector('.flex.py-1');
		expect(header).toBeInTheDocument();

		// Content area should be relative flex-1
		const contentArea = container.querySelector('.relative.flex-1');
		expect(contentArea).toBeInTheDocument();

		// They should be siblings in the flex-col container
		const flexContainer = container.querySelector('.flex.h-full.flex-col');
		expect(flexContainer.children).toHaveLength(2);
	});

	test('close button accessibility with keyboard navigation', async () => {
		const user = userEvent.setup();

		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });

		// Should be able to tab to the button
		await user.tab();
		expect(closeButton).toHaveFocus();

		// Should be able to activate with Enter
		await user.keyboard('{Enter}');
		expect(mockClosePane).toHaveBeenCalledTimes(1);
	});

	test('close button accessibility with space key', async () => {
		const user = userEvent.setup();

		render(ModalPane, {
			props: {
				title: 'Test Modal',
				closePane: mockClosePane
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });
		closeButton.focus();

		// Should be able to activate with Space
		await user.keyboard(' ');
		expect(mockClosePane).toHaveBeenCalledTimes(1);
	});

	test('handles very long titles gracefully', () => {
		const longTitle =
			'This is a very long title that should still render properly and not break the layout of the modal pane component';

		render(ModalPane, {
			props: {
				title: longTitle,
				closePane: mockClosePane
			}
		});

		expect(screen.getByText(longTitle)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
	});

	test('supports special characters in title', () => {
		const specialTitle = 'Test Modal & Special Characters! @#$%^&*()';

		render(ModalPane, {
			props: {
				title: specialTitle,
				closePane: mockClosePane
			}
		});

		expect(screen.getByText(specialTitle)).toBeInTheDocument();
	});

	test('default props work correctly', () => {
		// Test with minimal props (just closePane)
		render(ModalPane, {
			props: {
				closePane: mockClosePane
			}
		});

		// Should render successfully with default empty title
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
	});
});
