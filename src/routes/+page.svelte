<script>
	import { pushState } from '$app/navigation';
	import SearchPane from '$components/search/SearchPane.svelte';
	import MapContainer from '$components/MapContainer.svelte';
	import RouteModal from '$components/routes/RouteModal.svelte';
	import ViewAllRoutesModal from '$components/routes/ViewAllRoutesModal.svelte';
	import { isLoading } from 'svelte-i18n';
	import AlertsModal from '$components/navigation/AlertsModal.svelte';
	import { onMount } from 'svelte';
	import StopModal from '$components/stops/StopModal.svelte';
	import TripPlanModal from '$components/trip-planner/TripPlanModal.svelte';
	import { browser } from '$app/environment';

	let stop;
	let selectedTrip = null;
	let showRoute = false;
	let selectedRoute = null;
	let showRouteMap = false;
	let showAllStops = false;
	let showAllRoutesModal = false;
	let showTripPlanModal = false;
	let showRouteModal;
	let mapProvider = null;
	let currentIntervalId = null;
	let alert = null;
	let showAlertModal = false;
	let polylines = [];
	let stops = [];

	let tripItineraries = [];
	let loadingItineraries = false;
	let fromMarker = null;
	let toMarker = null;

	$: {
		if (showRouteModal && showAllRoutesModal) {
			showAllRoutesModal = false;
		}

		if (showAllRoutesModal) {
			showRouteModal = false;
		}
	}

	let currentHighlightedStopId = null;
	function stopSelected(event) {
		stop = event.detail.stop;
		pushState(`/stops/${stop.id}`);
		showAllRoutesModal = false;
		if (currentHighlightedStopId !== null) {
			mapProvider.unHighlightMarker(currentHighlightedStopId);
		}
		mapProvider.highlightMarker(stop.id);
		currentHighlightedStopId = stop.id;
	}

	function handleShowAllRoutes() {
		showRouteModal = false;
		showAllRoutesModal = true;
	}

	function handleRouteSelectedFromModal(event) {
		const route = event.detail.route;
		const customEvent = new CustomEvent('routeSelectedFromModal', {
			detail: { route }
		});
		window.dispatchEvent(customEvent);
		showAllRoutesModal = false;
	}

	function closePane() {
		if (polylines) {
			clearPolylines();
			mapProvider.removeStopMarkers();
			mapProvider.cleanupInfoWindow();
			mapProvider.clearVehicleMarkers();
			clearInterval(currentIntervalId);
		}
		stop = null;
		selectedTrip = null;
		selectedRoute = null;
		showRoute = false;
		showRouteModal = false;
		showAllRoutesModal = false;
		mapProvider.unHighlightMarker(currentHighlightedStopId);
		currentHighlightedStopId = null;
		showTripPlanModal = false;
	}

	function tripSelected(event) {
		if (event.detail) {
			selectedTrip = event.detail;
			showRoute = true;
			selectedRoute = {
				id: event.detail.routeId,
				shortName: event.detail.routeShortName
			};
		} else {
			selectedTrip = null;
			showRoute = false;
			selectedRoute = null;
		}
	}

	function handleUpdateRouteMap(event) {
		showRouteMap = event.detail.show;
		showAllStops = !event.detail.show;
	}

	function handleShowAllStops() {
		showAllStops = true;
		showRouteMap = false;
	}

	function handleRouteSelected(event) {
		selectedRoute = event.detail.route;
		polylines = event.detail.polylines;
		stops = event.detail.stops;
		currentIntervalId = event.detail.currentIntervalId;
		showRouteModal = true;
	}

	function clearPolylines() {
		polylines.map(async (p) => {
			mapProvider.removePolyline(await p);
		});

		mapProvider.removeStopMarkers();
		selectedRoute = null;
	}

	async function loadAlerts() {
		try {
			const response = await fetch('/api/oba/alerts');

			if (!response.ok || response.status === 204) {
				showAlertModal = false;
				return;
			}

			const data = await response.json();

			alert = data;
			showAlertModal = true;
		} catch (error) {
			console.error('Error loading alerts:', error);
		}
	}

	function handleTripPlan(event) {
		const tripData = event.detail.data;
		fromMarker = event.detail.fromMarker;
		toMarker = event.detail.toMarker;
		tripItineraries = tripData.plan?.itineraries;
		if (!tripItineraries) {
			console.error('No itineraries found', 404);
		}
		showTripPlanModal = true;
	}

	onMount(() => {
		loadAlerts();

		// close the trip plan modal when the tab is switched
		if (browser) {
			window.addEventListener('tabSwitched', () => {
				showTripPlanModal = false;
			});
		}
	});
</script>

{#if showAlertModal}
	<AlertsModal {alert} />
{/if}

{#if $isLoading}
	<p>Loading...</p>
{:else}
	<div class="pointer-events-none absolute bottom-0 left-0 right-0 top-0 z-40">
		<div class="mx-4 mt-4 flex h-full flex-col md:w-96">
			<SearchPane
				{mapProvider}
				cssClasses="pointer-events-auto"
				on:routeSelected={handleRouteSelected}
				on:clearResults={clearPolylines}
				on:viewAllRoutes={handleShowAllRoutes}
				on:tripPlanned={handleTripPlan}
			/>

			<div class="mt-4 flex-1">
				{#if stop}
					<StopModal
						on:close={closePane}
						on:tripSelected={tripSelected}
						on:updateRouteMap={handleUpdateRouteMap}
						on:showAllStops={handleShowAllStops}
						{stop}
						{showAllStops}
					/>
				{/if}

				{#if showRouteModal}
					<RouteModal on:close={closePane} {mapProvider} {stops} {selectedRoute} />
				{/if}

				{#if showAllRoutesModal}
					<ViewAllRoutesModal
						on:close={closePane}
						on:routeSelected={handleRouteSelectedFromModal}
					/>
				{/if}

				{#if showTripPlanModal}
					<TripPlanModal
						{mapProvider}
						itineraries={tripItineraries}
						{fromMarker}
						{toMarker}
						loading={loadingItineraries}
						on:close={closePane}
					/>
				{/if}
			</div>
		</div>
	</div>

	<MapContainer
		{selectedTrip}
		{selectedRoute}
		on:stopSelected={stopSelected}
		{showRoute}
		{showRouteMap}
		{stop}
		bind:mapProvider
	/>
{/if}
