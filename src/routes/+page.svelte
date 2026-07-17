<script>
	import { pushState } from '$app/navigation';
	import { page } from '$app/stores';
	import SearchPane from '$components/search/SearchPane.svelte';
	import MapContainer from '$components/MapContainer.svelte';
	import RouteModal from '$components/routes/RouteModal.svelte';
	import ViewAllRoutesModal from '$components/routes/ViewAllRoutesModal.svelte';
	import { isLoading } from 'svelte-i18n';
	import AlertsModal from '$components/navigation/AlertsModal.svelte';
	import { onMount, onDestroy } from 'svelte';
	import StopBottomSheet from '$components/stops/StopBottomSheet.svelte';
	import CollapsedSearchField from '$components/search/CollapsedSearchField.svelte';
	import TripPlanModal from '$components/trip-planner/TripPlanModal.svelte';
	import { browser } from '$app/environment';
	import {
		PUBLIC_OBA_REGION_NAME,
		PUBLIC_OBA_REGION_CENTER_LAT,
		PUBLIC_OBA_REGION_CENTER_LNG
	} from '$env/static/public';
	import SurveyModal from '$components/surveys/SurveyModal.svelte';
	import { loadSurveys } from '$lib/Surveys/surveyUtils';
	import { showSurveyModal } from '$stores/surveyStore';
	import { getUserId } from '$lib/utils/user';
	import analytics from '$lib/Insights';
	import { userLocation } from '$src/stores/userLocationStore';
	import { analyticsDistanceToStop } from '$lib/Insights/insightsUtils';
	import SurveyLauncher from '$components/surveys/SurveyLauncher.svelte';
	import { parseInitialCoordinates, cleanUrlParams } from '$lib/urlParams';
	import TripOptionsModal from '$components/trip-planner/TripOptionsModal.svelte';
	import { showTripOptionsModal } from '$stores/tripOptionsStore';

	// Parse initial coordinates from URL query parameters
	const initialCoords = parseInitialCoordinates(
		$page.url.searchParams,
		Number(PUBLIC_OBA_REGION_CENTER_LAT),
		Number(PUBLIC_OBA_REGION_CENTER_LNG)
	);

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
	let tripPlanError = $state(null);
	let loadingItineraries = false;
	let currentHighlightedStopId = null;

	let currentUserLocation = $state($userLocation);

	const Modal = {
		STOP: 'stop',
		ROUTE: 'route',
		ALL_ROUTES: 'allRoutes',
		TRIP_PLANNER: 'tripPlanner'
	};

	// While a stop's bottom sheet is open, the search pane collapses to a single
	// floating field below the md breakpoint; on wider viewports the pane stays
	// put (visibility is CSS-responsive, so there's no JS breakpoint detection).
	let searchCollapsed = $state(false);
	let sheetSnap = $state('half');
	let stopSheetOpen = $derived(currentModal === Modal.STOP);
	let showCollapsedSearch = $derived(stopSheetOpen && searchCollapsed);

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
		searchCollapsed = true;
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
			currentIntervalId = null;
		}

		mapProvider.unHighlightMarker(currentHighlightedStopId);
		stop = null;
		selectedTrip = null;
		selectedRoute = null;
		isRouteSelected = false;
		showRouteMap = false;
		currentHighlightedStopId = null;
		currentModal = null;
		// searchCollapsed needs no reset: its consumers are gated on stopSheetOpen,
		// and opening a stop always sets it. sheetSnap intentionally persists so
		// the next stop's sheet reopens at the rider's last-used height.
	}

	function expandSearch() {
		// Drop the sheet to peek so the re-expanded search pane isn't competing
		// with it for screen space.
		searchCollapsed = false;
		sheetSnap = 'peek';
	}

	function collapseSearch() {
		searchCollapsed = true;
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

	function clearTripItineraries() {
		tripItineraries = [];
		tripPlanError = null;
		currentModal = null;
		mapProvider.clearAllPolylines();
	}

	function closeTripPlanModal() {
		if (browser) {
			window.dispatchEvent(new CustomEvent('tripPlanModalClosed'));
		}
		clearTripItineraries();
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
	 * @param {Object} tripPlanData - The data returned from the trip planning API.
	 * @param {Object} tripPlanData.data - The trip planning data.
	 */
	function handleTripPlan(tripPlanData) {
		const tripData = tripPlanData.data;
		tripItineraries = tripData.plan?.itineraries || [];
		tripPlanError = tripData.error || null;
		currentModal = Modal.TRIP_PLANNER;
	}

	function handleTabSwitched() {
		// SearchPane owns trip-plan teardown when leaving the Plan tab (it dispatches tripPlanModalClosed and calls clearTripItineraries). Here we just close any open modal for the generic tab switch.
		currentModal = null;
	}

	function handlePlanTripTabClicked() {
		closePane();
	}

	onMount(() => {
		loadAlerts();

		const userId = getUserId();

		loadSurveys(null, userId);

		if (browser) {
			window.addEventListener('tabSwitched', handleTabSwitched);
			window.addEventListener('planTripTabClicked', handlePlanTripTabClicked);

			// Clean URL params after coordinates have been captured
			if (initialCoords) {
				cleanUrlParams();
			}
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('tabSwitched', handleTabSwitched);
			window.removeEventListener('planTripTabClicked', handlePlanTripTabClicked);
		}
		if (currentIntervalId) {
			clearInterval(currentIntervalId);
			currentIntervalId = null;
		}
	});
</script>

<svelte:head>
	<title>{PUBLIC_OBA_REGION_NAME}</title>
	<link
		rel="manifest"
		href="/api/manifest?start=/&name={encodeURIComponent(PUBLIC_OBA_REGION_NAME)}"
	/>
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content={PUBLIC_OBA_REGION_NAME} />
</svelte:head>

{#if showAlertModal}
	<AlertsModal {alert} />
{/if}

{#if $isLoading}
	<p>Loading...</p>
{:else}
	<h1 class="sr-only">{PUBLIC_OBA_REGION_NAME}</h1>
	<div class="pointer-events-none absolute bottom-0 left-0 right-0 top-0 z-40">
		<!-- Top spacing is padding (not margin) so h-full keeps the column's bottom
		     edge — where the sheet anchors — exactly at the viewport bottom. Horizontal
		     margins live on the search wrapper and on each pane (not the column) so the
		     bottom sheet in the slot below can run edge-to-edge on mobile. -->
		<div class="flex h-full flex-col pt-2 md:mx-4 md:w-96 md:pt-4">
			<div class="mx-2 md:mx-0">
				{#if showCollapsedSearch}
					<CollapsedSearchField onclick={expandSearch} />
				{/if}
				<SearchPane
					{mapProvider}
					cssClasses="pointer-events-auto"
					collapsed={showCollapsedSearch}
					{handleRouteSelected}
					{handleViewAllRoutes}
					{clearPolylines}
					{handleTripPlan}
					{handleStopMarkerSelect}
					{clearTripItineraries}
					onCollapse={stopSheetOpen ? collapseSearch : null}
				>
					{#snippet childContent()}
						<SurveyLauncher />
					{/snippet}
				</SearchPane>
			</div>

			<div class="relative mt-2 flex-1 md:mt-4">
				{#if stopSheetOpen}
					<StopBottomSheet
						{stop}
						{closePane}
						{tripSelected}
						{handleUpdateRouteMap}
						bind:snap={sheetSnap}
					/>
				{:else if currentModal === Modal.ROUTE}
					<RouteModal {closePane} {mapProvider} {stops} {selectedRoute} />
				{:else if currentModal === Modal.ALL_ROUTES}
					<ViewAllRoutesModal {closePane} {handleModalRouteClick} />
				{:else if currentModal === Modal.TRIP_PLANNER}
					<TripPlanModal
						{mapProvider}
						itineraries={tripItineraries}
						error={tripPlanError}
						loading={loadingItineraries}
						closePane={closeTripPlanModal}
					/>
				{/if}
			</div>
		</div>
	</div>

	{#if $showSurveyModal}
		<SurveyModal />
	{/if}

	{#if $showTripOptionsModal}
		<TripOptionsModal
			onClose={() => showTripOptionsModal.set(false)}
			onDone={() => showTripOptionsModal.set(false)}
		/>
	{/if}

	<MapContainer
		{selectedTrip}
		{selectedRoute}
		{stop}
		{handleStopMarkerSelect}
		{isRouteSelected}
		{showRouteMap}
		{initialCoords}
		bind:mapProvider
	/>
{/if}
