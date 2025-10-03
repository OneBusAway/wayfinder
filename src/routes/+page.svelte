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
	import { PUBLIC_OBA_REGION_NAME } from '$env/static/public';
	import SurveyModal from '$components/surveys/SurveyModal.svelte';
	import { loadSurveys } from '$lib/Surveys/surveyUtils';
	import { showSurveyModal } from '$stores/surveyStore';
	import { getUserId } from '$lib/utils/user';
	import analytics from '$lib/Analytics/PlausibleAnalytics';
	import { userLocation } from '$src/stores/userLocationStore';
	import { analyticsDistanceToStop } from '$lib/Analytics/plausibleUtils';
	import SurveyLauncher from '$components/surveys/SurveyLauncher.svelte';

	let currentModal = $state(null);
	let stop = $state();
	let selectedTrip = $state(null);
	let isRouteSelected = $state(false);
	let selectedRoute = $state(null);
	let showRouteMap = $state(false);
	let mapProvider = $state(null);
	let currentIntervalId = null;
	let alert = $state(null);
	let showAlertModal = $state(false);
	let stops = $state([]);
	let polylines = [];

	let tripItineraries = $state([]);
	let loadingItineraries = false;
	let fromMarker = $state(null);
	let toMarker = $state(null);
	let currentHighlightedStopId = null;

	let currentUserLocation = $state($userLocation);

	const Modal = {
		STOP: 'stop',
		ROUTE: 'route',
		ALL_ROUTES: 'allRoutes',
		TRIP_PLANNER: 'tripPlanner'
	};

	function handleStopMarkerSelect(stopData) {
		if (currentModal === Modal.ROUTE || selectedRoute || isRouteSelected) {
			mapProvider.clearAllPolylines();
			mapProvider.removeStopMarkers();
			mapProvider.clearVehicleMarkers();
			if (currentIntervalId) {
				clearInterval(currentIntervalId);
				currentIntervalId = null;
			}
			selectedRoute = null;
			isRouteSelected = false;
			selectedTrip = null;
		}
		currentModal = Modal.STOP;
		stop = stopData;
		pushState(`/stops/${stop.id}`);
		loadSurveys(stop, getUserId());

		if (mapProvider && mapProvider.flyTo) {
			mapProvider.flyTo(stopData.lat, stopData.lon, 16);
		}

		if (currentHighlightedStopId !== null) {
			mapProvider.unHighlightMarker(currentHighlightedStopId);
		}
		mapProvider.highlightMarker(stop.id);
		currentHighlightedStopId = stop.id;

		const distanceCategory = analyticsDistanceToStop(
			currentUserLocation.lat,
			currentUserLocation.lng,
			stop.lat,
			stop.lon
		);
		analytics.reportStopViewed(stop.id, distanceCategory);
	}

	function handleViewAllRoutes() {
		currentModal = Modal.ALL_ROUTES;
	}

	function handleModalRouteClick(route) {
		const customEvent = new CustomEvent('routeSelectedFromModal', {
			detail: { route }
		});
		window.dispatchEvent(customEvent);
		currentModal = null;
		isRouteSelected = true;
	}

	function closePane() {
		pushState('/');
		if (polylines) {
			mapProvider.clearAllPolylines();
			mapProvider.removeStopMarkers();
			mapProvider.cleanupInfoWindow();
			mapProvider.clearVehicleMarkers();
			clearInterval(currentIntervalId);
		}
		mapProvider.unHighlightMarker(currentHighlightedStopId);
		stop = null;
		selectedTrip = null;
		selectedRoute = null;
		isRouteSelected = false;
		showRouteMap = false;
		currentHighlightedStopId = null;
		currentModal = null;
	}

	function tripSelected(event) {
		if (event.detail) {
			selectedTrip = event.detail;
			isRouteSelected = true;
			selectedRoute = {
				id: event.detail.routeId,
				shortName: event.detail.routeShortName
			};

			if (stop && mapProvider && mapProvider.updatePopupContent) {
				const arrivalTime = event.detail.predictedArrivalTime || event.detail.scheduledArrivalTime;
				mapProvider.updatePopupContent(stop, arrivalTime);
			}
		} else {
			selectedTrip = null;
			isRouteSelected = false;
			selectedRoute = null;

			if (stop && mapProvider && mapProvider.updatePopupContent) {
				mapProvider.updatePopupContent(stop, null);
			}
		}
	}

	function handleUpdateRouteMap(event) {
		showRouteMap = event.detail.show;
	}

	/**
	 *
	 * @param {Object} routeData - The data related to the selected route.
	 * @param {Object} routeData.route - The selected route object.
	 * @param {Array} routeData.polylines - An array of polylines for the route.
	 * @param {Array} routeData.stops - An array of stops for the route.
	 * @param {number} routeData.currentIntervalId - The current interval ID.
	 */
	function handleRouteSelected(routeData) {
		selectedRoute = routeData.route;
		polylines = routeData.polylines;
		stops = routeData.stops;
		currentIntervalId = routeData.currentIntervalId;
		currentModal = Modal.ROUTE;
		isRouteSelected = true;
		analytics.reportRouteClicked(selectedRoute.id);
	}

	function clearPolylines() {
		polylines.map((p) => {
			mapProvider.removePolyline(p);
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
	/**
	 *
	 * @param {Object} tripPlanData - The data returned from the trip planning API.
	 * @param {Object} tripPlanData.data - The trip planning data.
	 * @param {Object} tripPlanData.fromMarker - The marker for the from location.
	 * @param {Object} tripPlanData.toMarker - The marker for the to location.
	 */
	function handleTripPlan(tripPlanData) {
		const tripData = tripPlanData.data;
		fromMarker = tripPlanData.fromMarker;
		toMarker = tripPlanData.toMarker;
		tripItineraries = tripData.plan?.itineraries;
		if (!tripItineraries) {
			console.error('No itineraries found', 404);
		}
		currentModal = Modal.TRIP_PLANNER;
	}

	onMount(() => {
		loadAlerts();

		const userId = getUserId();

		loadSurveys(null, userId);

		if (browser) {
			window.addEventListener('tabSwitched', () => {
				currentModal = null;
			});

			window.addEventListener('planTripTabClicked', () => {
				closePane();
			});
		}
	});
</script>

<svelte:head>
	<title>{PUBLIC_OBA_REGION_NAME}</title>
</svelte:head>

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
				{handleRouteSelected}
				{handleViewAllRoutes}
				{clearPolylines}
				{handleTripPlan}
				{handleStopMarkerSelect}
			>
				{#snippet childContent()}
					<SurveyLauncher />
				{/snippet}
			</SearchPane>

			<div class="mt-4 flex-1">
				{#if currentModal === Modal.STOP}
					<StopModal {closePane} {tripSelected} {handleUpdateRouteMap} {stop} />
				{:else if currentModal === Modal.ROUTE}
					<RouteModal {closePane} {mapProvider} {stops} {selectedRoute} />
				{:else if currentModal === Modal.ALL_ROUTES}
					<ViewAllRoutesModal {closePane} {handleModalRouteClick} />
				{:else if currentModal === Modal.TRIP_PLANNER}
					<TripPlanModal
						{mapProvider}
						itineraries={tripItineraries}
						{fromMarker}
						{toMarker}
						loading={loadingItineraries}
						{closePane}
					/>}
				{/if}
			</div>
		</div>
	</div>

	{#if $showSurveyModal}
		<SurveyModal />
	{/if}

	<MapContainer
		{selectedTrip}
		{selectedRoute}
		{stop}
		{handleStopMarkerSelect}
		{isRouteSelected}
		{showRouteMap}
		bind:mapProvider
	/>
{/if}
