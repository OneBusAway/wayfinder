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
	// Forces an immediate vehicle refresh (see fetchAndUpdateVehiclesForRoutes)
	// rather than waiting up to 30s for the next scheduled poll. Set once the
	// poll started by the main redraw effect below resolves; read by the
	// promotion effect so expanding a trip moves the amber glow right away.
	let vehicleTick = null;
	// Incremented per load so a superseded selection's in-flight fetches bail out
	// instead of drawing over the newer one.
	let loadToken = 0;
	// The content signature (see the $effect below) that produced the routes
	// currently on the map, so a redraw can be skipped when a new
	// activeRoutes/routeColors identity carries identical content.
	let lastSignature = null;
	// routeId -> the polyline drawn for it, so the promotion effect below can
	// re-pane a route without re-fetching or re-creating anything. Named
	// distinctly from drawRoutes' local `drawnPolylines` paint-order array
	// below, which tracks something else (resolution order, for
	// bringToFront). Populated as each route's shape resolves in drawRoutes;
	// cleared in teardown().
	let polylinesByRouteId = new Map();
	// The route currently sitting in ROUTE_PANE.PROMOTED, so the promotion
	// effect can demote it before promoting a new one. Reset in teardown()
	// since a redraw discards every polyline, promoted or not.
	let currentlyPromotedRouteId = null;

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
		if (token !== loadToken) return;

		// Publish immediately rather than waiting for the first shape to
		// resolve (or, if every fetch fails, never). Between teardown and the
		// first resolution this briefly leaves dots un-ringed rather than
		// still ringed for the *previous* stop's routes — a stale ring lies
		// about which stop is selected, an absent one just looks momentary.
		routeStopIds = new Map();

		// Accumulated outside the map closure so concurrent resolutions merge
		// into one shared map instead of each mapper invocation racing to publish
		// its own partial snapshot over the others.
		const nextStopIds = new Map();
		// Which route index currently claims each stop, so a shared stop is
		// decided by index priority (soonest-arrival-first) rather than by
		// whichever shape happens to resolve first over the network.
		const stopClaimIndex = new Map();
		// Polylines drawn so far this call, so paint order can be restored to
		// index order after every resolution — Leaflet/Google paint in the
		// order createPolyline resolved, which is shape-fetch race order, not
		// activeRoutes order.
		const drawnPolylines = [];

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
				if (token !== loadToken) {
					// A supersede ran clearAllPolylines() before this create resolved
					// (Google's createPolyline is async, awaiting importLibrary), so
					// the polyline this call just attached to the map is an orphan of
					// the selection that's already gone — take it back off.
					mapProvider.removePolyline(polyline);
					return;
				}
				if (!polyline) return;

				// Retained so the promotion effect can re-pane this route later
				// without redrawing it. isPromoted was already decided above (from
				// the untracked promotedRouteId read at the top of this callback),
				// so the promotion effect's own idea of "currently promoted" starts
				// in sync with what was actually drawn.
				polylinesByRouteId.set(route.id, polyline);
				if (isPromoted) currentlyPromotedRouteId = route.id;

				// Reveal only this route: its neighbors may already be drawn, and
				// re-animating them on every resolution would look like a glitch.
				mapProvider.revealPolylines({ only: [polyline], duration: 0.8 });

				// Paint order is shape-fetch resolution order, not index order, so
				// re-assert index order after every resolution: the widest route
				// (lowest index) must stay backmost and the narrower ones (higher
				// index) frontmost, or the widest — if it happens to resolve last —
				// paints over the narrower ones entirely and the fringe described
				// above disappears. Calling bringToFront() ascending by index, last
				// call wins, puts the highest index frontmost. bringToFront is a
				// Leaflet Path method the OSM provider's polyline exposes directly;
				// it's a no-op on Google's polyline object, whose paint order already
				// comes from the pane's zIndex set at creation, so this line is
				// harmless there.
				drawnPolylines.push({ index, polyline });
				drawnPolylines.sort((a, b) => a.index - b.index);
				for (const drawn of drawnPolylines) {
					drawn.polyline.bringToFront?.();
				}

				// A shared stop is claimed by index priority: only a lower index
				// (sooner-arriving route) may overwrite a stop already claimed by a
				// higher one, regardless of which of the two resolves first. Both
				// the mutation and the publish happen synchronously within this
				// resolved route's turn, so two routes resolving "at the same time"
				// (already-resolved microtasks) still apply one at a time rather than
				// clobbering each other's contribution.
				for (const stopId of shape.stopIds) {
					const claimedIndex = stopClaimIndex.get(stopId);
					if (claimedIndex === undefined || index < claimedIndex) {
						nextStopIds.set(stopId, color);
						stopClaimIndex.set(stopId, index);
					}
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
		vehicleTick = null;
	}

	function teardown() {
		stopVehiclePolling();
		// mapProvider can be null: a cold deep-link whose arrivals land before
		// initMap() resolves mounts this layer with no provider yet, and
		// onDestroy calls teardown() unconditionally.
		mapProvider?.clearAllPolylines();
		mapProvider?.clearVehicleMarkers();
		// clearVehicleMarkers only detaches markers; the module-level map would
		// otherwise hand stale entries to the next selection.
		clearVehicleMarkersMap();
		// clearAllPolylines() above only tears down the map layer side; the
		// promotion effect's own bookkeeping must be reset here too, or it would
		// try to re-pane a polyline that no longer exists.
		polylinesByRouteId.clear();
		currentlyPromotedRouteId = null;
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
	//  - highlightedTripId is passed down as a getter closure (see
	//    fetchAndUpdateVehiclesForRoutes' `highlightedTripId` option), not read
	//    directly here, so defining the closure doesn't itself read the prop —
	//    only *calling* it later would. It's still wrapped in untrack() for the
	//    same defensive reason as promotedRouteId above: so a future refactor
	//    that calls the getter synchronously, inside this effect, doesn't
	//    silently start tracking it.
	// Net effect: expanding a trip (which only changes promotedRouteId /
	// highlightedTripId) does not re-fire this effect, does not tear down and
	// redraw every polyline, and does not restart the vehicle poll — exactly the
	// "no flash on expand" requirement. Moving the promoted pane and the
	// highlight glow in response to those two props is instead handled by the
	// second, narrowly-scoped $effect below.
	$effect(() => {
		const routes = activeRoutes;
		const colors = routeColors;

		// Redraw is keyed on a content signature, not on activeRoutes/routeColors
		// identity. StopPane polls arrivals every ~30s, and MapExperience's
		// $derived recomputes activeRoutesFromArrivals/assignRouteColors from
		// scratch on every poll, handing this effect a brand-new array and a
		// brand-new Map even when nothing actually changed. Keying on identity
		// tore down and redrew everything — every polyline and casing, every
		// vehicle marker (restarting animateMarker's position interpolation from
		// scratch), 2x the shape/vehicle requests, and a replayed 0.8s draw
		// animation — every 30 seconds. A signature built from route ids and
		// their resolved line colors catches actual changes while ignoring
		// re-allocation noise.
		//
		// Sorted deliberately: activeRoutes is ordered soonest-arrival-first and
		// genuinely reshuffles as predictions update, so an order-sensitive
		// signature would still redraw on every reshuffle even when the route
		// set and colors are unchanged. The cost is that stroke weights (which
		// come from index/order — see weightFor) reflect whichever order was
		// current at the *first* draw of this route set, not the live
		// soonest-first order; that's a far smaller price than refetching and
		// re-animating every 30 seconds.
		const signature = routes
			.map((route) => `${route.id}:${colors.get(route.id)?.line ?? ''}`)
			.sort()
			.join('|');

		if (!mapProvider) return;
		if (signature === lastSignature) return;
		lastSignature = signature;

		const token = ++loadToken;
		teardown();

		// An emptied route set must still tear down (polylines, vehicle
		// markers, the poll interval) rather than leaving the previous
		// selection on the map indefinitely — teardown() above already
		// happened; there's just nothing to redraw.
		if (routes.length === 0) return;

		drawRoutes(routes, colors, token).catch((error) => {
			console.error('StopRoutesLayer: drawRoutes failed', error);
		});

		// A getter, not a captured value: highlightedTripId can change (via trip
		// expansion) without this effect re-running, so the poll must re-read it
		// on every tick rather than freezing whatever it was when the poll
		// started. Wrapped in untrack() so that if a future refactor ever calls
		// this getter synchronously from inside an effect, it still won't
		// register highlightedTripId as that effect's dependency.
		fetchAndUpdateVehiclesForRoutes(routes, mapProvider, {
			highlightedTripId: () => untrack(() => highlightedTripId),
			colorsByRouteId: colors,
			onCounts: (counts) => {
				if (token === loadToken) liveCounts = counts;
			}
		})
			.then(({ intervalId, tick }) => {
				// A newer load took over while this poll was starting; don't leak it.
				if (token !== loadToken) {
					clearInterval(intervalId);
					return;
				}
				vehicleIntervalId = intervalId;
				vehicleTick = tick;
			})
			.catch((error) => {
				console.error('StopRoutesLayer: vehicle poll failed', error);
			});
	});

	// Narrowly scoped: tracks only promotedRouteId and highlightedTripId, the
	// two props the main redraw effect above deliberately excludes. This is
	// what actually makes trip expansion move the promoted pane and the
	// highlight glow — every other read in here is wrapped in untrack() so
	// this effect can never fire a redraw, a shape refetch, or a poll restart;
	// see the main effect's comment for why that separation exists.
	$effect(() => {
		const promoted = promotedRouteId;
		// Read only to register as a dependency — the value itself is consumed
		// live, inside vehicleUtils' tick(), via the getter closure passed to
		// fetchAndUpdateVehiclesForRoutes above.
		void highlightedTripId;

		untrack(() => {
			// No-op before the first draw has landed: mapProvider may still be
			// null (a cold deep-link mounts this layer before initMap()
			// resolves), and before any route has been drawn there is nothing to
			// re-pane and no poll yet to nudge.
			if (!mapProvider) return;

			if (promoted !== currentlyPromotedRouteId) {
				// Demote the previously promoted route first — if the polyline it
				// named ever resolved. Tolerated as a no-op otherwise (its shape
				// fetch may have failed, or nothing was promoted yet).
				const previousPolyline = currentlyPromotedRouteId
					? polylinesByRouteId.get(currentlyPromotedRouteId)
					: null;
				if (previousPolyline) {
					mapProvider.setPolylineLayer(previousPolyline, ROUTE_PANE.LINE);
				}

				// Promote the new one — same tolerance: promotedRouteId may name a
				// route whose shape fetch failed, in which case there's no
				// polyline to move and this is a no-op.
				const nextPolyline = promoted ? polylinesByRouteId.get(promoted) : null;
				if (nextPolyline) {
					mapProvider.setPolylineLayer(nextPolyline, ROUTE_PANE.PROMOTED);
				}

				currentlyPromotedRouteId = promoted;
			}

			// Force an immediate refresh rather than waiting up to 30s for the
			// next scheduled poll, so the amber glow moves right away. Guarded
			// because the poll's setup promise may not have resolved yet (e.g.
			// this effect's first run, racing the main effect's initial draw).
			vehicleTick?.();
		});
	});

	onDestroy(() => {
		loadToken++;
		teardown();
	});
</script>
