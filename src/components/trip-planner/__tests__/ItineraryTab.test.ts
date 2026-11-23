import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ItineraryTab from '../ItineraryTab.svelte';
import type { Itinerary, ItineraryLeg } from '$lib/types';

function itineraryWithModes(...modes: string[]): Itinerary {
	const legs: ItineraryLeg[] = modes.map((mode) => ({ distance: 100, duration: 60, mode }));
	return { duration: 600, endTime: 600_000, legs, startTime: 0 };
}

function renderTab(...modes: string[]) {
	const { container } = render(ItineraryTab, {
		props: {
			activeTab: 0,
			index: 0,
			itinerary: itineraryWithModes(...modes),
			setActiveTab: vi.fn()
		}
	});
	const summary = container.querySelector('.itinerary-tab > span:last-child')!;
	return {
		arrowCount: summary.textContent!.split('→').length - 1,
		iconCount: summary.querySelectorAll('svg').length,
		transitIcons: [...summary.querySelectorAll('svg[data-icon]')].map((svg) =>
			svg.getAttribute('data-icon')
		)
	};
}

describe('ItineraryTab', () => {
	test('shows one icon per distinct mode, separated by arrows', () => {
		const { arrowCount, iconCount, transitIcons } = renderTab('WALK', 'BUS', 'WALK', 'RAIL');

		expect(transitIcons).toEqual(['bus', 'train']);
		expect(iconCount).toBe(3);
		expect(arrowCount).toBe(2);
	});

	test.each([
		['SUBWAY', 'train-subway'],
		['TRAM', 'train-subway'],
		['CABLE_CAR', 'cable-car'],
		['GONDOLA', 'cable-car'],
		['FUNICULAR', 'cable-car']
	])('shows an icon for a %s leg', (mode, iconName) => {
		const { arrowCount, iconCount, transitIcons } = renderTab('WALK', mode, 'WALK');

		expect(transitIcons).toEqual([iconName]);
		expect(iconCount).toBe(2);
		expect(arrowCount).toBe(1);
	});

	test('does not start with an arrow when the first mode has no icon', () => {
		const { arrowCount, iconCount } = renderTab('AIRPLANE', 'WALK');

		expect(iconCount).toBe(1);
		expect(arrowCount).toBe(0);
	});
});
