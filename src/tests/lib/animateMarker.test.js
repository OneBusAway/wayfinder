import { describe, it, expect } from 'vitest';
import { buildRoutePath } from '$lib/MapHelpers/animateMarker';

describe('buildRoutePath', () => {
	// An L-shaped route: go east along lng, then north along lat.
	const lShapedRoute = [
		{ lat: 0, lng: 0 },
		{ lat: 0, lng: 1 },
		{ lat: 1, lng: 1 }
	];

	it('follows the route corner instead of cutting across diagonally', () => {
		const from = { lat: 0, lng: 0 };
		const to = { lat: 1, lng: 1 };

		const path = buildRoutePath([lShapedRoute], from, to);

		// The path must pass through the corner (0,1), not go straight to (1,1).
		expect(path).toEqual([
			{ lat: 0, lng: 0 },
			{ lat: 0, lng: 1 },
			{ lat: 1, lng: 1 }
		]);
	});

	it('walks the shape backwards when the vehicle travels the other way', () => {
		const from = { lat: 1, lng: 1 };
		const to = { lat: 0, lng: 0 };

		const path = buildRoutePath([lShapedRoute], from, to);

		expect(path).toEqual([
			{ lat: 1, lng: 1 },
			{ lat: 0, lng: 1 },
			{ lat: 0, lng: 0 }
		]);
	});

	it('returns null when an endpoint is too far from the route (off-route)', () => {
		const from = { lat: 0, lng: 0 };
		const to = { lat: 5, lng: 5 }; // hundreds of km away

		expect(buildRoutePath([lShapedRoute], from, to)).toBeNull();
	});

	it('returns null when no usable shape is provided', () => {
		expect(buildRoutePath([], { lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeNull();
		expect(
			buildRoutePath([[{ lat: 0, lng: 0 }]], { lat: 0, lng: 0 }, { lat: 0, lng: 1 })
		).toBeNull();
	});

	it('picks the closest of multiple shapes (e.g. opposite directions)', () => {
		const near = [
			{ lat: 0, lng: 0 },
			{ lat: 0, lng: 1 }
		];
		const far = [
			{ lat: 0.5, lng: 0 },
			{ lat: 0.5, lng: 1 }
		];

		const path = buildRoutePath([far, near], { lat: 0, lng: 0.2 }, { lat: 0, lng: 0.8 });

		// Endpoints sit on `near`, so the snapped path stays on the equator.
		expect(path[0]).toEqual({ lat: 0, lng: 0.2 });
		expect(path[path.length - 1]).toEqual({ lat: 0, lng: 0.8 });
		expect(path.every((p) => p.lat === 0)).toBe(true);
	});
});
