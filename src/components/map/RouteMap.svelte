<script>
	import { calculateMidpoint } from '$lib/mathUtils';
	import { clearVehicleMarkersMap, fetchAndUpdateVehicles } from '$lib/vehicleUtils';
	import { mapContrastColor } from '$lib/colorUtils';
	import { onMount, onDestroy } from 'svelte';
	let { mapProvider, tripId, currentSelectedStop = null } = $props();
	let shapeId = null;
	let tripData = null;
	let shapeData = null;
	let isMounted = true;

	// used to clear interval api calls
	let currentIntervalId = null;
	let loadRouteDataPromise = null;

	onMount(async () => {
		loadRouteDataPromise = loadRouteData();
		await loadRouteDataPromise;
	});

	onDestroy(async () => {
		isMounted = false;
		if (loadRouteDataPromise) {
			await loadRouteDataPromise;
		}

		// No tripId means loadRouteData bailed before drawing anything (see the
		// guard below) — a transient mount/unmount like this must not clear
		// polylines/markers it never created, nor fly to the stop as if a trip
		// had just finished loading.
		if (!tripId) {
			return;
		}

		await Promise.all([
			mapProvider.clearAllPolylines(),
			mapProvider.removeStopMarkers(),
			mapProvider.cleanupInfoWindow(),
			mapProvider.clearVehicleMarkers(),
			clearInterval(currentIntervalId),
			clearVehicleMarkersMap(mapProvider)
		]);

		if (currentSelectedStop) {
			mapProvider.flyTo(currentSelectedStop.lat, currentSelectedStop.lon, 18);
		}
	});

	async function loadRouteData() {
		// A transient mount (e.g. selectedTrip going null while this is briefly
		// rendered during a stop close) can land here with no tripId. Bail before
		// touching the map or issuing a `/api/oba/trip-details/null` request.
		if (!tripId) {
			return;
		}

		try {
			mapProvider.clearAllPolylines();
			mapProvider.removeStopMarkers();

			const tripResponse = await fetch(`/api/oba/trip-details/${tripId}`);
			tripData = await tripResponse.json();

			const tripReferences = tripData?.data?.references?.trips;
			const moreTripData = tripReferences?.find((t) => t.id == tripId);

			shapeId = moreTripData?.shapeId;
			const routeId = moreTripData?.routeId;

			const route = tripData?.data?.references?.routes?.find((r) => r.id === routeId);
			const dark = document.documentElement.classList.contains('dark');
			const routeColor = mapContrastColor(route?.color, { dark });

			if (shapeId && isMounted) {
				const shapeResponse = await fetch(`/api/oba/shape/${shapeId}`);
				shapeData = await shapeResponse.json();
				const shapePoints = shapeData?.data?.entry?.points;
				if (shapePoints && isMounted) {
					await mapProvider.createPolyline(shapePoints, { color: routeColor });
				}
			}

			const stopTimes = tripData?.data?.entry?.schedule?.stopTimes ?? [];
			const stops = tripData?.data?.references?.stops ?? [];

			// Fit the view to the full route shape so it's always centered and
			// visible regardless of route length. Fall back to the stops' midpoint
			// when no polyline could be drawn (e.g. missing shape data). Awaiting the
			// fit lets the stop markers appear in sync with the route reveal instead
			// of popping in before the camera has settled. Guard the fit on its own
			// so a camera failure can't stop the stop markers/vehicles from rendering.
			let fitted = false;
			try {
				fitted = await mapProvider.fitToPolylines?.();
			} catch (error) {
				console.error('Error fitting route to view:', error);
			}
			if (!fitted) {
				const location = calculateMidpoint(stops);
				if (location) {
					mapProvider.flyTo(location.lat, location.lon, 13);
				}
			}

			for (const stopTime of stopTimes) {
				const stop = stops.find((s) => s.id === stopTime.stopId);
				if (stop && isMounted) {
					mapProvider.addStopRouteMarker(stop, stopTime);
				}
			}

			if (routeId && isMounted) {
				// Highlight the vehicle serving the trip the user clicked, while still
				// showing the other vehicles running this route.
				currentIntervalId = await fetchAndUpdateVehicles(
					routeId,
					mapProvider,
					undefined,
					tripId,
					routeColor ?? undefined
				);
			}
		} catch (error) {
			console.error(`Error loading route data for trip ${tripId}:`, error);
		}
	}
</script>
