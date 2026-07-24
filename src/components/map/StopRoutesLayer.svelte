<!--
    @component
    Draws the routes a rider can actually board from the selected stop, plus the
    live vehicles feeding those arrivals.

    Deliberately narrower than RouteMap, which draws a single trip's shape and
    clears the map first. This layer draws one shape per *route* in the arrivals
    list and owns its own teardown, so a stop selection and a trip expansion can
    coexist.

    @prop {Object} mapProvider
    @prop {ActiveRoute[]} activeRoutes - soonest arrival first; drives draw order
    @prop {Map<string, RouteColors>} routeColors
    @prop {string|null} promotedRouteId - the expanded arrival's route, drawn on top
    @prop {string|null} highlightedTripId - the expanded arrival's trip; its vehicle glows
    @prop {Map<string,string>} routeStopIds - bindable out: stop id -> ring-dot color
    @prop {Map<string,number>} liveCounts - bindable out: route id -> live vehicle count
-->
<script>
	import { onDestroy, untrack } from 'svelte';
	import { fetchAndUpdateVehiclesForRoutes, clearVehicleMarkersMap } from '$lib/vehicleUtils.js';
	// From the provider-neutral module, NOT from a provider: importing either
	// provider here would pull its whole map stack into the bundle regardless of
	// which one PUBLIC_OBA_MAP_PROVIDER selects.
	import { ROUTE_PANE } from '$lib/mapPanes.js';

	let {
		mapProvider,
		activeRoutes = [],
		routeColors = new Map(),
		promotedRouteId = null,
		highlightedTripId = null,
		routeStopIds = $bindable(new Map()),
		liveCounts = $bindable(new Map())
	} = $props();

	// Widest route draws first and each subsequent route is a little narrower, so
	// a route underneath shows as a colored fringe either side of the one above
	// it. This is what keeps two routes legible in a shared corridor: all casings
	// live in one pane below all colored strokes, so the fringe isn't covered.
	// A true perpendicular offset would need a zoom-reactive screen-space
	// transform and has no cross-provider primitive — see the design spec.
	const BASE_WEIGHT = 7;
	const MIN_WEIGHT = 4;

	let vehicleIntervalId = null;
	// Incremented per load so a superseded selection's in-flight fetches bail out
	// instead of drawing over the newer one.
	let loadToken = 0;

	function weightFor(index) {
		return Math.max(MIN_WEIGHT, BASE_WEIGHT - index);
	}

	async function fetchRouteShape(route) {
		// includeStatus=false: the endpoint defaults it to true, and we need only
		// the shape id and the stop times.
		const tripResponse = await fetch(`/api/oba/trip-details/${route.tripId}?includeStatus=false`);
		if (!tripResponse.ok) {
			throw new Error(`trip-details ${tripResponse.status} for trip ${route.tripId}`);
		}
		const tripData = await tripResponse.json();

		const tripRef = tripData?.data?.references?.trips?.find((trip) => trip.id === route.tripId);
		const shapeId = tripRef?.shapeId;
		if (!shapeId) {
			throw new Error(`no shapeId for trip ${route.tripId}`);
		}

		const shapeResponse = await fetch(`/api/oba/shape/${shapeId}`);
		if (!shapeResponse.ok) {
			throw new Error(`shape ${shapeResponse.status} for shape ${shapeId}`);
		}
		const shapeData = await shapeResponse.json();

		const stopIds = (tripData?.data?.entry?.schedule?.stopTimes ?? [])
			.map((stopTime) => stopTime.stopId)
			.filter(Boolean);

		return { points: shapeData?.data?.entry?.points, stopIds };
	}

	async function drawRoutes(routes, colors, token) {
		// Accumulated outside the map closure so concurrent resolutions merge
		// into one shared map instead of each mapper invocation racing to publish
		// its own partial snapshot over the others.
		const nextStopIds = new Map();

		await Promise.all(
			routes.map(async (route, index) => {
				const color = colors.get(route.id)?.line;
				let shape;
				try {
					shape = await fetchRouteShape(route);
				} catch (error) {
					// One missing shape degrades the map rather than breaking it: the
					// other routes still draw, and this one is simply absent from the
					// lines, the legend, and the ring dots.
					console.error('StopRoutesLayer: could not load shape', route.id, error);
					return;
				}
				if (token !== loadToken || !shape.points) return;

				// untrack: this read happens after an await, so Svelte would not treat
				// it as an effect dependency anyway — but reading it explicitly through
				// untrack makes that non-dependency intentional rather than incidental,
				// so a future refactor that moves this above the await doesn't silently
				// turn trip-expansion into a full redraw.
				const promoted = untrack(() => promotedRouteId);
				const isPromoted = promoted != null && route.id === promoted;
				const polyline = await mapProvider.createPolyline(shape.points, {
					color,
					casing: true,
					weight: weightFor(index),
					pane: isPromoted ? ROUTE_PANE.PROMOTED : ROUTE_PANE.LINE,
					casingPane: ROUTE_PANE.CASING
				});
				if (token !== loadToken) return;
				if (!polyline) return;

				// Reveal only this route: its neighbors may already be drawn, and
				// re-animating them on every resolution would look like a glitch.
				mapProvider.revealPolylines({ only: [polyline], duration: 0.8 });

				// First route to claim a stop wins, and routes arrive soonest-first,
				// so a shared stop takes the color of the route arriving next. Both
				// the mutation and the publish happen synchronously within this
				// resolved route's turn, so two routes resolving "at the same time"
				// (already-resolved microtasks) still apply one at a time rather than
				// clobbering each other's contribution.
				for (const stopId of shape.stopIds) {
					if (!nextStopIds.has(stopId)) nextStopIds.set(stopId, color);
				}
				routeStopIds = new Map(nextStopIds);
			})
		);
	}

	function stopVehiclePolling() {
		if (vehicleIntervalId) {
			clearInterval(vehicleIntervalId);
			vehicleIntervalId = null;
		}
	}

	function teardown() {
		stopVehiclePolling();
		mapProvider.clearAllPolylines();
		mapProvider.clearVehicleMarkers();
		// clearVehicleMarkers only detaches markers; the module-level map would
		// otherwise hand stale entries to the next selection.
		clearVehicleMarkersMap();
	}

	// Tracks only activeRoutes and routeColors: those two are what define which
	// routes and colors need to be on the map, so only they should tear down and
	// redraw everything. promotedRouteId and highlightedTripId are consumed here
	// too (to pick the promoted pane and to seed the vehicle poll's highlight),
	// but neither is allowed to become a dependency:
	//  - promotedRouteId is read inside drawRoutes' per-route callback, after an
	//    `await` — Svelte only tracks reads that happen synchronously within the
	//    effect's own call stack, and an async function's continuation after its
	//    first await runs in a later microtask, outside that stack. So this read
	//    is naturally untracked; it's wrapped in untrack() anyway so that stays
	//    true even if the code is later reordered above the await.
	//  - highlightedTripId is read synchronously (while building the options
	//    object passed to fetchAndUpdateVehiclesForRoutes, before any await), so
	//    without untrack() it WOULD become a dependency. untrack() is required
	//    here, not just defensive.
	// Net effect: expanding a trip (which only changes promotedRouteId /
	// highlightedTripId) does not re-fire this effect, does not tear down and
	// redraw every polyline, and does not restart the vehicle poll — exactly the
	// "no flash on expand" requirement. The tradeoff is that a vehicle's
	// highlight glow reflects whichever trip was expanded when the current
	// route set was drawn; expanding a different trip without changing routes
	// won't move the glow until the next redraw. No interface exists yet to
	// update just the highlight without restarting the poll.
	$effect(() => {
		const routes = activeRoutes;
		const colors = routeColors;
		const token = ++loadToken;

		if (!mapProvider || routes.length === 0) return;

		teardown();
		drawRoutes(routes, colors, token);

		// untrack(() => highlightedTripId): this options object is built
		// synchronously — before any await — as part of *calling*
		// fetchAndUpdateVehiclesForRoutes, so a plain read here would register as
		// an effect dependency and re-trigger the whole redraw/re-poll on every
		// trip expansion. untrack keeps the poll itself scoped to
		// activeRoutes/routeColors while still passing the current
		// highlightedTripId value into this run's poll.
		fetchAndUpdateVehiclesForRoutes(routes, mapProvider, {
			highlightedTripId: untrack(() => highlightedTripId),
			colorsByRouteId: colors,
			onCounts: (counts) => {
				if (token === loadToken) liveCounts = counts;
			}
		}).then((intervalId) => {
			// A newer load took over while this poll was starting; don't leak it.
			if (token !== loadToken) {
				clearInterval(intervalId);
				return;
			}
			vehicleIntervalId = intervalId;
		});
	});

	onDestroy(() => {
		loadToken++;
		teardown();
	});
</script>
