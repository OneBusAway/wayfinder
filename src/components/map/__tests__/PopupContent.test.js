import { render, screen } from '@testing-library/svelte';
import { describe, test, expect, vi } from 'vitest';
import PopupContent from '../PopupContent.svelte';

const STOP = {
	id: '1_3470',
	name: 'Beacon Ave S & S Lander St',
	code: '3470',
	direction: 'SW',
	routes: [
		{ id: '1_100210', shortName: '36', color: '28813F', textColor: 'FFFFFF', type: 3 },
		{ id: '1_100249', shortName: '60', type: 3 }
	]
};

function renderPopup(props = {}) {
	return render(PopupContent, {
		props: { stop: STOP, arrivalTime: null, handleStopMarkerSelect: vi.fn(), ...props }
	});
}

describe('PopupContent', () => {
	test('shows the stop name and its direction and code subtitle', () => {
		renderPopup();

		expect(screen.getByRole('heading', { name: STOP.name })).toBeInTheDocument();
		// The $t mock echoes keys, so directionLabel and the code label resolve to ids.
		expect(screen.getByText('direction.SW · favorites.stop_code: 3470')).toBeInTheDocument();
	});

	test('shows a pill for each route serving the stop', () => {
		renderPopup();

		expect(screen.getByText('36')).toBeInTheDocument();
		expect(screen.getByText('60')).toBeInTheDocument();
	});

	test('caps the pills and counts the rest', () => {
		const routes = ['36', '60', '107', '131', '132'].map((shortName, i) => ({
			id: `route-${i}`,
			shortName,
			type: 3
		}));
		renderPopup({ stop: { ...STOP, routes } });

		expect(screen.getByText('107')).toBeInTheDocument();
		expect(screen.queryByText('131')).not.toBeInTheDocument();
		expect(screen.getByText('+2')).toBeInTheDocument();
	});

	test.each([
		['no routes array', undefined],
		['an empty routes array', []],
		['routes without short names', [{ id: 'route-1', type: 3 }]]
	])('omits the route row with %s', (_name, routes) => {
		const { container } = renderPopup({ stop: { ...STOP, routes } });

		expect(container.querySelectorAll('span[style*="background-color"]')).toHaveLength(0);
	});

	test('shows the arrival line only when an arrival time is given', () => {
		const { unmount } = renderPopup();
		expect(screen.queryByText('arrives_at')).not.toBeInTheDocument();
		unmount();

		renderPopup({ arrivalTime: 38280 });
		expect(screen.getByText('arrives_at')).toBeInTheDocument();
	});

	test('calls handleStopMarkerSelect from the action button', async () => {
		const handleStopMarkerSelect = vi.fn();
		renderPopup({ handleStopMarkerSelect });

		screen.getByRole('button', { name: 'view_stop_information' }).click();

		expect(handleStopMarkerSelect).toHaveBeenCalledOnce();
	});
});
