import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	buildRoutePath,
	animateMarkerTo,
	cancelMarkerAnimation
} from '$lib/MapHelpers/animateMarker';

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

describe('cancelMarkerAnimation', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('no-ops on a null marker (the removeVehicleMarker path can hit that)', () => {
		expect(() => cancelMarkerAnimation(null)).not.toThrow();
	});

	it('cancels the stored frame and clears the id', () => {
		const cancel = vi.fn();
		vi.stubGlobal('cancelAnimationFrame', cancel);

		const marker = { _animationFrameId: 42 };
		cancelMarkerAnimation(marker);

		expect(cancel).toHaveBeenCalledWith(42);
		expect(marker._animationFrameId).toBeNull();
	});
});

describe('animateMarkerTo', () => {
	let frames;
	let now;

	// Drive requestAnimationFrame manually: each scheduled callback is queued,
	// and runFrames() invokes the pending callbacks at the given timestamps.
	function runFrames(times) {
		for (const t of times) {
			now = t;
			const pending = frames;
			frames = [];
			pending.forEach((cb) => cb(now));
		}
	}

	beforeEach(() => {
		frames = [];
		now = 0;
		vi.stubGlobal('requestAnimationFrame', (cb) => {
			frames.push(cb);
			return frames.length;
		});
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		vi.stubGlobal('performance', { now: () => now });
	});

	afterEach(() => vi.unstubAllGlobals());

	it('moves instantly (no frame scheduled) when from equals to', () => {
		const setPosition = vi.fn();
		animateMarkerTo({}, { lat: 1, lng: 2 }, { lat: 1, lng: 2 }, setPosition);

		expect(setPosition).toHaveBeenCalledTimes(1);
		expect(setPosition).toHaveBeenCalledWith(1, 2);
		expect(frames).toHaveLength(0);
	});

	it('moves instantly when requestAnimationFrame is unavailable', () => {
		vi.stubGlobal('requestAnimationFrame', undefined);
		const setPosition = vi.fn();

		animateMarkerTo({}, { lat: 0, lng: 0 }, { lat: 1, lng: 1 }, setPosition);

		expect(setPosition).toHaveBeenCalledWith(1, 1);
	});

	it('lands exactly on the target on the final frame and clears the id', () => {
		const setPosition = vi.fn();
		const marker = {};

		animateMarkerTo(marker, { lat: 0, lng: 0 }, { lat: 10, lng: 20 }, setPosition, {
			duration: 1000
		});
		runFrames([0, 500, 1000]);

		expect(setPosition.mock.calls.at(-1)).toEqual([10, 20]);
		expect(marker._animationFrameId).toBeNull();
	});

	it('follows the route geometry (corner) instead of the diagonal', () => {
		const route = [
			{ lat: 0, lng: 0 },
			{ lat: 0, lng: 1 },
			{ lat: 1, lng: 1 }
		];
		const setPosition = vi.fn();

		animateMarkerTo({}, { lat: 0, lng: 0 }, { lat: 1, lng: 1 }, setPosition, {
			duration: 1000,
			routePaths: [route]
		});
		runFrames([0, 100, 1000]);

		// Early on, the marker is still travelling the bottom edge: lat stays 0
		// and lng has advanced. A diagonal cut would have lat === lng > 0.
		const early = setPosition.mock.calls[1];
		expect(early[0]).toBe(0);
		expect(early[1]).toBeGreaterThan(0);
		// And it still finishes exactly on the target.
		expect(setPosition.mock.calls.at(-1)).toEqual([1, 1]);
	});

	it('falls back to a straight line when routePaths are supplied but the vehicle is off-route', () => {
		const route = [
			{ lat: 0, lng: 0 },
			{ lat: 0, lng: 1 }
		];
		const setPosition = vi.fn();

		// Both endpoints are hundreds of km from the shape, so buildRoutePath bails
		// (returns null) and animateMarkerTo interpolates a straight diagonal.
		animateMarkerTo({}, { lat: 5, lng: 5 }, { lat: 7, lng: 7 }, setPosition, {
			duration: 1000,
			routePaths: [route]
		});
		runFrames([0, 500, 1000]);

		// Straight line from (5,5) to (7,7): lat and lng advance in lockstep.
		const mid = setPosition.mock.calls[1];
		expect(mid[0]).toBe(mid[1]);
		expect(setPosition.mock.calls.at(-1)).toEqual([7, 7]);
	});

	it('cancels an in-flight animation when called again', () => {
		const setPosition = vi.fn();
		const marker = {};

		animateMarkerTo(marker, { lat: 0, lng: 0 }, { lat: 1, lng: 1 }, setPosition, {
			duration: 1000
		});
		runFrames([0, 200]);

		animateMarkerTo(marker, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }, setPosition, {
			duration: 1000
		});

		expect(cancelAnimationFrame).toHaveBeenCalled();
	});
});
