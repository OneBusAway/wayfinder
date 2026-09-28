import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AccordionFixture from './AccordionFixture.svelte';

describe('Accordion', () => {
	let animate;

	beforeEach(() => {
		animate = Element.prototype.animate;
		Element.prototype.animate = vi.fn(() => {
			const animation = { cancel: vi.fn(), currentTime: 0, onfinish: null };
			queueMicrotask(() => animation.onfinish?.());
			return animation;
		});
	});

	afterEach(() => {
		Element.prototype.animate = animate;
	});

	test('registers and independently toggles schedule items without payloads', async () => {
		render(AccordionFixture);
		const first = screen.getByRole('button', { name: 'First route' });
		const second = screen.getByRole('button', { name: 'Second route' });
		expect(screen.getByTestId('registered-items')).toHaveTextContent('2');

		await fireEvent.click(first);
		await fireEvent.click(second);
		expect(first).toHaveAttribute('aria-expanded', 'true');
		expect(second).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText('First route')).toHaveClass('active');
		expect(screen.getByText('Second route schedule')).toBeInTheDocument();

		await fireEvent.click(first);
		expect(first).toHaveAttribute('aria-expanded', 'false');
		expect(second).toHaveAttribute('aria-expanded', 'true');
	});

	test.each([true, false])('expands and collapses all with animate=%s', async (animate) => {
		render(AccordionFixture, { props: { animate } });
		const first = screen.getByRole('button', { name: 'First route' });
		const second = screen.getByRole('button', { name: 'Second route' });

		await fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
		expect(first).toHaveAttribute('aria-expanded', 'true');
		expect(second).toHaveAttribute('aria-expanded', 'true');
		await fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
		expect(first).toHaveAttribute('aria-expanded', 'false');
		expect(second).toHaveAttribute('aria-expanded', 'false');
		expect(screen.getByTestId('registered-items')).toHaveTextContent('2');
	});
});
