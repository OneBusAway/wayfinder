/**
 * Default duration (ms) used to glide a vehicle marker between two real-time
 * position updates.
 */
export const VEHICLE_ANIMATION_DURATION = 1200;

/**
 * Cancels an in-flight marker movement animation, if any.
 * @param {object} marker - a map marker that may hold an `_animationFrameId`.
 */
export function cancelMarkerAnimation(marker) {
	if (marker && marker._animationFrameId) {
		cancelAnimationFrame(marker._animationFrameId);
		marker._animationFrameId = null;
	}
}

/**
 * Smoothly moves a marker from its current position to a target position by
 * interpolating between them each animation frame, so real-time vehicle updates
 * glide along the route instead of teleporting.
 *
 * Any animation already running on the marker is cancelled first, so frequent
 * updates always animate from the marker's current on-screen position.
 *
 * @param {object} marker - the map marker (uses an `_animationFrameId` field to track/cancel animations).
 * @param {{ lat: number, lng: number }} from - starting coordinates.
 * @param {{ lat: number, lng: number }} to - target coordinates.
 * @param {(lat: number, lng: number) => void} setPosition - applies a position to the marker.
 * @param {number} [duration=VEHICLE_ANIMATION_DURATION] - animation length in milliseconds.
 */
export function animateMarkerTo(
	marker,
	from,
	to,
	setPosition,
	duration = VEHICLE_ANIMATION_DURATION
) {
	cancelMarkerAnimation(marker);

	// Fall back to an instant move when animation isn't available (e.g. SSR,
	// test environments) or when the marker hasn't actually moved.
	if (typeof requestAnimationFrame !== 'function' || (from.lat === to.lat && from.lng === to.lng)) {
		setPosition(to.lat, to.lng);
		return;
	}

	const start = performance.now();
	const step = (now) => {
		const t = Math.min((now - start) / duration, 1);
		// ease-out cubic for a natural deceleration as the vehicle reaches its fix
		const eased = 1 - Math.pow(1 - t, 3);
		setPosition(from.lat + (to.lat - from.lat) * eased, from.lng + (to.lng - from.lng) * eased);

		if (t < 1) {
			marker._animationFrameId = requestAnimationFrame(step);
		} else {
			marker._animationFrameId = null;
		}
	};

	marker._animationFrameId = requestAnimationFrame(step);
}
