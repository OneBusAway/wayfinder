import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi } from 'vitest';
import StopItem from '../StopItem.svelte';
import { mockStopData, mockStopDataWithoutRoutes } from '../../../tests/fixtures/obaData.js';

describe('StopItem', () => {
	const mockStop = {
		id: '1_75403',
		name: 'Pine St & 3rd Ave',
		code: '75403',
		lat: 47.61053848,
		lon: -122.33631134
	};

	const mockStopWithoutCode = {
		id: '1_75404',
		name: 'Test Stop Without Code',
		lat: 47.61053848,
		lon: -122.33631134
	};

	test('displays stop name and code', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStop,
				handleStopItemClick
			}
		});

		expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		expect(screen.getByText('75403')).toBeInTheDocument();
	});

	test('displays stop name without code when code is missing', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStopWithoutCode,
				handleStopItemClick
			}
		});

		expect(screen.getByText('Test Stop Without Code')).toBeInTheDocument();
		// Code should not be displayed if not present
		expect(screen.queryByText('undefined')).not.toBeInTheDocument();
	});

	test('calls handleStopItemClick when clicked', async () => {
		const user = userEvent.setup();
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStop,
				handleStopItemClick
			}
		});

		const button = screen.getByRole('button');
		await user.click(button);

		expect(handleStopItemClick).toHaveBeenCalledWith(mockStop);
		expect(handleStopItemClick).toHaveBeenCalledTimes(1);
	});

	test('has proper button attributes and classes', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStop,
				handleStopItemClick
			}
		});

		const button = screen.getByRole('button');
		expect(button).toHaveAttribute('type', 'button');
		expect(button).toHaveClass('stop-item');
		expect(button).toHaveClass('flex', 'w-full', 'items-center', 'justify-between');
		expect(button).toHaveClass('border-b', 'border-gray-200');
		expect(button).toHaveClass('bg-[#f9f9f9]', 'p-4', 'text-left');
		expect(button).toHaveClass('hover:bg-[#e9e9e9]', 'focus:outline-none');
	});

	test('has proper dark mode classes', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStop,
				handleStopItemClick
			}
		});

		const button = screen.getByRole('button');
		expect(button).toHaveClass('dark:border-[#313135]');
		expect(button).toHaveClass('dark:bg-[#1c1c1c]');
		expect(button).toHaveClass('dark:hover:bg-[#363636]');
	});

	test('stop name has proper styling classes', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStop,
				handleStopItemClick
			}
		});

		const stopNameElement = screen.getByText('Pine St & 3rd Ave');
		expect(stopNameElement).toHaveClass('text-lg', 'font-semibold');
		expect(stopNameElement).toHaveClass('text-[#000000]', 'dark:text-white');
	});

	test('stop code has proper styling classes', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStop,
				handleStopItemClick
			}
		});

		const stopCodeElement = screen.getByText('75403');
		expect(stopCodeElement).toHaveClass('text-md', 'text-[#86858B]');
	});

	test('is keyboard accessible', async () => {
		const user = userEvent.setup();
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStop,
				handleStopItemClick
			}
		});

		const button = screen.getByRole('button');

		// Focus the button
		button.focus();
		expect(button).toHaveFocus();

		// Activate with Enter key
		await user.keyboard('{Enter}');
		expect(handleStopItemClick).toHaveBeenCalledWith(mockStop);

		// Reset the mock
		handleStopItemClick.mockClear();

		// Activate with Space key
		await user.keyboard(' ');
		expect(handleStopItemClick).toHaveBeenCalledWith(mockStop);
	});

	test('has proper accessibility attributes', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStop,
				handleStopItemClick
			}
		});

		const button = screen.getByRole('button');
		expect(button).toHaveAttribute('type', 'button');
		expect(button).toBeInTheDocument();
	});

	test('handles stop with empty name gracefully', () => {
		const handleStopItemClick = vi.fn();
		const emptyStop = {
			id: 'empty_stop',
			name: '',
			code: '12345'
		};

		// This should not throw an error
		expect(() => {
			render(StopItem, {
				props: {
					stop: emptyStop,
					handleStopItemClick
				}
			});
		}).not.toThrow();

		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
		expect(screen.getByText('12345')).toBeInTheDocument();
	});

	test('handles stop with null/undefined properties gracefully', () => {
		const handleStopItemClick = vi.fn();
		const nullStop = {
			id: 'null_stop',
			name: null,
			code: null
		};

		// This should not throw an error
		expect(() => {
			render(StopItem, {
				props: {
					stop: nullStop,
					handleStopItemClick
				}
			});
		}).not.toThrow();

		const button = screen.getByRole('button');
		expect(button).toBeInTheDocument();
	});

	test('uses real fixture data correctly', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStopData,
				handleStopItemClick
			}
		});

		expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		expect(screen.getByText('75403')).toBeInTheDocument();
	});

	test('uses stop without routes fixture correctly', () => {
		const handleStopItemClick = vi.fn();

		render(StopItem, {
			props: {
				stop: mockStopDataWithoutRoutes,
				handleStopItemClick
			}
		});

		expect(screen.getByText('Test Stop Without Routes')).toBeInTheDocument();
		expect(screen.getByText('75404')).toBeInTheDocument();
	});
});
