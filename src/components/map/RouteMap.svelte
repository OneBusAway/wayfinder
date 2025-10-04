<script>
	import { calculateMidpoint } from '$lib/mathUtils';
	import { clearVehicleMarkersMap, fetchAndUpdateVehicles } from '$lib/vehicleUtils';
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
		mapProvider.clearAllPolylines();
		mapProvider.removeStopMarkers();

		const tripResponse = await fetch(`/api/oba/trip-details/${tripId}`);
		tripData = await tripResponse.json();

		const tripReferences = tripData?.data?.references?.trips;
		const moreTripData = tripReferences?.find((t) => t.id == tripId);

		shapeId = moreTripData?.shapeId;
		const routeId = moreTripData?.routeId;

		if (shapeId && isMounted) {
			const shapeResponse = await fetch(`/api/oba/shape/${shapeId}`);
			shapeData = await shapeResponse.json();
			const shapePoints = shapeData?.data?.entry?.points;
			if (shapePoints && isMounted) {
				await mapProvider.createPolyline(shapePoints);
			}
		}

		const stopTimes = tripData?.data?.entry?.schedule?.stopTimes ?? [];
		const stops = tripData?.data?.references?.stops ?? [];
		// TODO: implement better way to transition to route shape
		const location = calculateMidpoint(stops);

		mapProvider.flyTo(location.lat, location.lng, 13);

		for (const stopTime of stopTimes) {
			const stop = stops.find((s) => s.id === stopTime.stopId);
			if (stop && isMounted) {
				mapProvider.addStopRouteMarker(stop, stopTime);
			}
		}

		if (routeId && isMounted) {
			currentIntervalId = await fetchAndUpdateVehicles(routeId, mapProvider);
		}
	}
</script>
