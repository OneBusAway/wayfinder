import { render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';
import OptionsPill from '../components/trip-planner/OptionsPill.svelte';

describe('OptionsPill', () => {
	test('renders an empty label without an icon by default', () => {
		const { container } = render(OptionsPill);
		const pill = container.firstElementChild;

		expect(pill).toBeInTheDocument();
		expect(pill.children).toHaveLength(1);
		expect(pill.firstElementChild.textContent).toBe('');
	});

	test('renders the label without an optional icon', () => {
		render(OptionsPill, { props: { label: 'Wheelchair accessible' } });

		const label = screen.getByText('Wheelchair accessible');
		expect(label).toBeInTheDocument();
		expect(label.parentElement.children).toHaveLength(1);
	});

	test('renders the supplied icon alongside the label', () => {
		render(OptionsPill, { props: { icon: '♿', label: 'Wheelchair accessible' } });

		expect(screen.getByText('♿')).toBeInTheDocument();
		expect(screen.getByText('Wheelchair accessible')).toBeInTheDocument();
	});

	test('updates the label and adds and removes the optional icon', async () => {
		const { rerender } = render(OptionsPill, { props: { label: 'Bus' } });

		await rerender({ label: 'Walk', icon: '🚶' });

		expect(screen.queryByText('Bus')).not.toBeInTheDocument();
		expect(screen.getByText('Walk')).toBeInTheDocument();
		expect(screen.getByText('🚶')).toBeInTheDocument();

		await rerender({ label: 'Walk', icon: '' });

		expect(screen.getByText('Walk')).toBeInTheDocument();
		expect(screen.queryByText('🚶')).not.toBeInTheDocument();
		expect(screen.getByText('Walk').parentElement.children).toHaveLength(1);
	});
});
