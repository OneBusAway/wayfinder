import { render } from '@testing-library/svelte';
import { expect, test, describe } from 'vitest';
import Skeleton from '../Skeleton.svelte';

describe('Skeleton', () => {
	test('renders with default classes', () => {
		const { container } = render(Skeleton);
		const div = container.firstElementChild;

		expect(div).toBeInTheDocument();
		expect(div).toHaveClass('animate-pulse');
		expect(div).toHaveClass('rounded-md');
		expect(div).toHaveClass('bg-gray-200');
		expect(div).toHaveClass('dark:bg-gray-700');
	});

	test('applies custom classes passed via props', () => {
		const { container } = render(Skeleton, { class: 'h-10 w-full mt-4' });
		const div = container.firstElementChild;

		expect(div).toHaveClass('animate-pulse');
		expect(div).toHaveClass('h-10');
		expect(div).toHaveClass('w-full');
		expect(div).toHaveClass('mt-4');
	});
});
