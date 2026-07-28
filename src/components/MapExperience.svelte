<script>
	import { pushState, replaceState, afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
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
	import { hasTripParams } from '$lib/urlState';
	import { env } from '$env/dynamic/public';
	import TripOptionsModal from '$components/trip-planner/TripOptionsModal.svelte';
	import { showTripOptionsModal } from '$stores/tripOptionsStore';
	import { mapStopPath } from '$lib/mapStopUrl.js';
	import { clearVehicleMarkersMap } from '$lib/vehicleUtils';
	import { activeRoutesFromArrivals, assignRouteColors } from '$lib/activeRoutes.js';

	// One-time snapshot at mount: on a cold /map/stops/{id} load, `data.stopData` is
	// present, so boot the map centered on the stop (the selection effect then applies
	// the mobile offset with animate:false — no visible pan). Otherwise fall back to the
	// existing ?lat/?lng query params / region center.
	const initialPage = get(page);
	const initialCoords = initialPage.data?.stopData
		? { lat: initialPage.data.stopData.lat, lng: initialPage.data.stopData.lon }
		: parseInitialCoordinates(
				initialPage.url.searchParams,
				Number(PUBLIC_OBA_REGION_CENTER_LAT),
				Number(PUBLIC_OBA_REGION_CENTER_LNG)
			);

	// Any shared-trip URL (valid or broken) should enter trip-plan mode before the
	// map loads stops, so region-center markers are never painted and then stuck.
	const startInTripPlanMode =
		browser && !!env.PUBLIC_OTP_SERVER_URL && hasTripParams(initialPage.url.searchParams);

	let currentModal = $state(null);
	let selectedTrip = $state(null);
	// Bound up from StopBottomSheet -> StopPane, so the map draws the routes behind
	// the arrivals the rider is actually looking at, with no second fetch.
	let stopArrivals = $state(null);
	let isDarkMode = $state(false);
	let isRouteSelected = $state(false);
	let selectedRoute = $state(null);
	let showRouteMap = $state(false);
	let mapProvider = $state(null);
	let currentIntervalId = null;
	let alert = $state(null);
	let showAlertModal = $state(false);
	let stops = $state([]);
	let polylines = [];
	let themeChangeHandler = null;

	let tripItineraries = $state([]);
	let tripPlanError = $state(null);
	let loadingItineraries = false;
	let currentHighlightedStopId = null;

	// Last stop id the effect acted on, and whether the map was already interactive
	// on a prior run — used to decide animate (cold load snaps; in-app taps animate).
	let appliedStopId = null;
	let mapWasReady = false;

	let currentUserLocation = $state($userLocation);

	const Modal = {
		ROUTE: 'route',
		ALL_ROUTES: 'allRoutes',
		TRIP_PLANNER: 'tripPlanner'
	};

	// Fraction of map height to lift a selected stop above center so the mobile
	// bottom sheet (half detent, ~55% tall) doesn't cover it — lands it ~25% down.
	const MOBILE_STOP_MAP_OFFSET_Y = 0.25;

	// The open stop is driven by page.state.stopData. A marker tap sets it via shallow
	// pushState; a cold load / share seeds it from the server load's page.data in
	// afterNavigate (below). IMPORTANT: shallow pushState updates page.state and the browser
	// URL bar, but NOT the reactive $page.url — so page.state, not the URL, is the
	// signal. Because page.state is cleared on close, gating on its presence is safe
	// (unlike page.data, which lingers after a real navigation).
	let selectedStopData = $derived($page.state?.stopData ?? null);
	let selectedStopId = $derived(selectedStopData?.id ?? null);

	// Gate on the stop id, not on truthiness: tapping stop A -> stop B keeps the
	// sheet mounted, so `stopArrivals` still holds A's response until B's fetch
	// lands. Without this the map would briefly draw A's routes around B's marker.
	let arrivalsMatchSelection = $derived(
		stopArrivals?.data?.entry?.stopId != null && stopArrivals.data.entry.stopId === selectedStopId
	);
	let activeRoutes = $derived(arrivalsMatchSelection ? activeRoutesFromArrivals(stopArrivals) : []);
	// Deliberately NOT gated on arrivalsMatchSelection (derived from stopArrivals
	// directly, not from the gated activeRoutes above). StopPane's rendered rows are
	// a one-time $state seed that doesn't react to stopArrivals going stale, so
	// during the A -> B transition the sheet is still showing A's rows — A's colors
	// are the correct colors for them. The map is separately held back from drawing
	// anything stale by activeRoutes being empty until B's arrivals land. Two
	// consumers of routeColors, two different staleness semantics, one source.
	let routeColors = $derived(
		assignRouteColors(activeRoutesFromArrivals(stopArrivals), { dark: isDarkMode })
	);

	// While a stop's bottom sheet is open, the search pane collapses to a single
	// floating field below the md breakpoint; on wider viewports the pane stays
	// put (visibility is CSS-responsive, so there's no JS breakpoint detection).
	let searchCollapsed = $state(false);
	let sheetSnap = $state('half');
	let stopSheetOpen = $derived(selectedStopId != null);
	let showCollapsedSearch = $derived(stopSheetOpen && searchCollapsed);

	// Mobile plan mode: Plan tab UI lives in the bottom sheet (form + recent +
	// results) instead of stacking a tall SearchPane card above itineraries (#577).
	const NARROW_VIEWPORT_MQ = '(max-width: 767px)';
	let planTabActive = $state(false);
	let isNarrowViewport = $state(browser ? window.matchMedia(NARROW_VIEWPORT_MQ).matches : false);
	let mobilePlanSheetOpen = $derived(planTabActive && isNarrowViewport);
	// Hide the top SearchPane on mobile while the plan sheet owns the UI (desktop
	// keeps the existing left-rail SearchPane + results sheet).
	let hideSearchForMobilePlan = $derived(mobilePlanSheetOpen);
	let mediaQueryList = null;
	function syncNarrowViewport(event) {
		isNarrowViewport = event.matches;
	}

	function handleStopMarkerSelect(stopData) {
		// Instant: the marker already carries the stop, so push it into history state
		// (no fetch). The selection effect reacts to the URL change and frames the map.
		// $state.snapshot: the marker's stopData is a reactive proxy, and pushState
		// structured-clones its state argument (DataCloneError on a proxy). Snapshot
		// yields a plain, clone-safe copy.
		pushState(mapStopPath(stopData.id), { stopData: $state.snapshot(stopData) });
	}

	$effect(() => {
		const id = selectedStopId; // track
		const provider = mapProvider; // track — null until MapContainer mounts

		if (!provider) return; // wait for the map (re-runs when mapProvider is set)

		if (id === appliedStopId) {
			// On a cold /map/stops/{id} load this branch runs first with both ids null
			// (page.state isn't seeded until afterNavigate). Don't flip mapWasReady then,
			// or the deferred stop selection would animate instead of snapping. A normal
			// load (no cold stopData) can mark the map ready so later in-app taps animate.
			if (!initialPage.data?.stopData) mapWasReady = true;
			return;
		}

		if (id) {
			const data = selectedStopData;
			if (!data) return; // wait for state/load data; re-runs when it arrives

			// A stop supersedes any other selection. Tear down the map overlays a route
			// or trip left behind only when one was active, but always clear currentModal
			// (including ALL_ROUTES / TRIP_PLANNER, which draw no map overlays) and its
			// selection state so no modal reappears when the stop sheet closes.
			if (
				currentModal === Modal.ROUTE ||
				currentModal === Modal.TRIP_PLANNER ||
				selectedRoute ||
				isRouteSelected
			) {
				provider.clearAllPolylines();
				provider.removeStopMarkers();
				provider.clearVehicleMarkers();
				if (currentIntervalId) {
					clearInterval(currentIntervalId);
					currentIntervalId = null;
				}
				selectedRoute = null;
				isRouteSelected = false;
				selectedTrip = null;
				tripItineraries = [];
				tripPlanError = null;
			}
			currentModal = null;

			searchCollapsed = true;
			if (browser && window.innerWidth >= 768) sheetSnap = 'full';

			const offsetY = browser && window.innerWidth < 768 ? MOBILE_STOP_MAP_OFFSET_Y : 0;
			// mapWasReady is false only on the very first framing (cold load) → snap
			// instantly; later in-app selections animate.
			provider.flyTo(data.lat, data.lon, 16, { offsetY, animate: mapWasReady });

			if (currentHighlightedStopId !== null) provider.unHighlightMarker(currentHighlightedStopId);
			provider.highlightMarker(id);
			currentHighlightedStopId = id;

			loadSurveys(data, getUserId());
			analytics.reportStopViewed(
				id,
				analyticsDistanceToStop(
					currentUserLocation.lat,
					currentUserLocation.lng,
					data.lat,
					data.lon
				)
			);
		} else {
			// Closed (back button or close): tear down the stop overlay.
			if (currentHighlightedStopId !== null) {
				provider.unHighlightMarker(currentHighlightedStopId);
				currentHighlightedStopId = null;
			}
			provider.resetStopEmphasis();
			provider.setBasemapDimmed(false);
			provider.cleanupInfoWindow();
			// Don't wipe vehicle markers or the route-selection flags a route is drawing:
			// when a route is selected from an open stop sheet, handleRouteSelected has
			// already set currentModal = Modal.ROUTE, isRouteSelected = true, and
			// selectedRoute before this teardown flushes (both run in the same effect
			// flush). Resetting these unconditionally would stomp that selection back to
			// null/false while currentModal stays ROUTE, leaving RouteModal rendering with
			// a null route. A normal stop close leaves currentModal null.
			if (currentModal !== Modal.ROUTE) {
				provider.clearVehicleMarkers();
				// clearVehicleMarkers only detaches the markers from the map. The module
				// -level vehicleMarkersMap still holds them, so the next selection would
				// find stale entries via .has() and update detached markers that never
				// render. RouteMap's onDestroy already pairs these two calls.
				clearVehicleMarkersMap();
				// closePane() short-circuits for the stop case (pushState + return), and the
				// accordion never fires its collapse callback because StopPane is destroyed
				// rather than collapsed. So if the rider had a row expanded, these three are
				// still truthy — which pins mapMode at ROUTE forever and permanently stops
				// markers from loading. Reset them here, where every close path converges.
				showRouteMap = false;
				isRouteSelected = false;
				selectedRoute = null;
			}
			selectedTrip = null;
			stopArrivals = null;
		}

		appliedStopId = id;
		mapWasReady = true;
	});

	function handleViewAllRoutes() {
		currentModal = Modal.ALL_ROUTES;
		// On desktop (md+) the sheet is a fixed side panel rather than a mobile
		// bottom sheet, so open it fully instead of at the half detent.
		if (browser && window.innerWidth >= 768) {
			sheetSnap = 'full';
		}
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
		if (stopSheetOpen) {
			pushState('/', {}); // selection effect runs the map/stop teardown
			return;
		}
		// route / all-routes / trip-planner modals are local state
		if (polylines) {
			mapProvider.clearAllPolylines();
			mapProvider.removeStopMarkers();
			mapProvider.cleanupInfoWindow();
			mapProvider.clearVehicleMarkers();
			clearInterval(currentIntervalId);
			currentIntervalId = null;
		}
		selectedTrip = null;
		selectedRoute = null;
		isRouteSelected = false;
		showRouteMap = false;
		currentModal = null;
	}

	let snapBeforeSearchExpand = null;

	function expandSearch() {
		// Drop the sheet to peek so the re-expanded search pane isn't competing
		// with it for screen space.
		snapBeforeSearchExpand = sheetSnap;
		searchCollapsed = false;
		sheetSnap = 'peek';
	}

	function collapseSearch() {
		searchCollapsed = true;
		// Give the arrivals their space back — but only if the sheet is still at
		// the programmatic peek from expandSearch; a height the rider chose in
		// the meantime is left alone.
		if (sheetSnap === 'peek' && snapBeforeSearchExpand) {
			sheetSnap = snapBeforeSearchExpand;
		}
		snapBeforeSearchExpand = null;
	}

	function tripSelected(event) {
		if (event.detail) {
			selectedTrip = event.detail;
			isRouteSelected = true;
			selectedRoute = {
				id: event.detail.routeId,
				shortName: event.detail.routeShortName
			};

			if (selectedStopData && mapProvider && mapProvider.updatePopupContent) {
				const arrivalTime = event.detail.predictedArrivalTime || event.detail.scheduledArrivalTime;
				mapProvider.updatePopupContent(selectedStopData, arrivalTime);
			}
		} else {
			selectedTrip = null;
			isRouteSelected = false;
			selectedRoute = null;

			if (selectedStopData && mapProvider && mapProvider.updatePopupContent) {
				mapProvider.updatePopupContent(selectedStopData, null);
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
		if (stopSheetOpen) pushState('/', {});
		selectedRoute = routeData.route;
		polylines = routeData.polylines;
		stops = routeData.stops;
		currentIntervalId = routeData.currentIntervalId;
		currentModal = Modal.ROUTE;
		isRouteSelected = true;
		// On desktop (md+) the sheet is a fixed side panel rather than a mobile
		// bottom sheet, so open it fully instead of at the half detent.
		if (browser && window.innerWidth >= 768) {
			sheetSnap = 'full';
		}
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
		const hadTripUi =
			tripItineraries.length > 0 || tripPlanError != null || currentModal === Modal.TRIP_PLANNER;
		tripItineraries = [];
		tripPlanError = null;
		currentModal = null;
		mapProvider.clearAllPolylines();
		// Back to edit height when the rider clears results but stays on the mobile plan sheet.
		if (hadTripUi && planTabActive && isNarrowViewport) {
			sheetSnap = 'half';
		}
	}

	function closeTripPlanModal() {
		if (browser) {
			window.dispatchEvent(new CustomEvent('tripPlanModalClosed'));
		}
		clearTripItineraries();
	}

	/** Exit mobile plan-sheet mode: clear results and return SearchPane to Stops. */
	function closeMobilePlanSheet() {
		if (browser) {
			window.dispatchEvent(new CustomEvent('tripPlanModalClosed'));
			window.dispatchEvent(new CustomEvent('openStopsTab'));
		}
		planTabActive = false;
		clearTripItineraries();
		sheetSnap = 'half';
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
		// Desktop: sheet fills the left rail. Mobile: raise to full when we have
		// itineraries so leg details aren't cramped under the form; leave half
		// on empty/error so the rider can edit and still see the map.
		if (browser && window.innerWidth >= 768) {
			sheetSnap = 'full';
		} else if (tripItineraries.length > 0) {
			sheetSnap = 'full';
		}
	}

	function handleTabSwitched() {
		// SearchPane owns trip-plan teardown when leaving the Plan tab (it dispatches tripPlanModalClosed and calls clearTripItineraries). Here we just close any open modal for the generic tab switch.
		planTabActive = false;
		currentModal = null;
	}

	function handlePlanTripTabClicked() {
		planTabActive = true;
		// Editing state: half keeps the map visible behind From/To.
		if (isNarrowViewport) {
			sheetSnap = 'half';
		}
		closePane();
	}

	onMount(() => {
		loadAlerts();

		const userId = getUserId();

		loadSurveys(null, userId);

		if (browser) {
			window.addEventListener('tabSwitched', handleTabSwitched);
			window.addEventListener('planTripTabClicked', handlePlanTripTabClicked);

			mediaQueryList = window.matchMedia(NARROW_VIEWPORT_MQ);
			isNarrowViewport = mediaQueryList.matches;
			mediaQueryList.addEventListener('change', syncNarrowViewport);

			// Clean URL params after coordinates have been captured
			if (initialCoords) {
				cleanUrlParams();
			}

			isDarkMode = document.documentElement.classList.contains('dark');
			const onThemeChange = (event) => {
				isDarkMode = event.detail.darkMode;
			};
			window.addEventListener('themeChange', onThemeChange);
			themeChangeHandler = onThemeChange;
		}
	});

	// Cold load / share: the server load placed the stop in page.data, but the sheet
	// and framing effect are driven by page.state (shallow routing never populates
	// page.state on first load). Copy it across once so a shared link behaves exactly
	// like an in-app tap. afterNavigate (not onMount) because replaceState can't run
	// before the client router is initialized, and it fires on the cold-load mount.
	// page.data.stopData is already a plain SSR object, so no snapshot is needed.
	afterNavigate(() => {
		// Defer one macrotask: on the initial cold-load hydration, afterNavigate runs
		// before SvelteKit marks the client router initialized, and replaceState throws
		// until then. A 0ms timeout lets hydration finish first. Harmless on '/' (there
		// is no page.data.stopData) and idempotent (guarded on !page.state.stopData).
		setTimeout(() => {
			if ($page.data?.stopData && !$page.state?.stopData) {
				replaceState('', { stopData: $page.data.stopData });
			}
		}, 0);
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('tabSwitched', handleTabSwitched);
			window.removeEventListener('planTripTabClicked', handlePlanTripTabClicked);
			if (mediaQueryList) {
				mediaQueryList.removeEventListener('change', syncNarrowViewport);
			}
			if (themeChangeHandler) {
				window.removeEventListener('themeChange', themeChangeHandler);
			}
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
		     edge — where the sheet anchors — exactly at the viewport bottom. Below md,
		     horizontal margins live on the search wrapper and on each pane (not the
		     column) so the bottom sheet in the slot below can run edge-to-edge. -->
		<div class="flex h-full flex-col pt-2 md:mx-4 md:w-96 md:pt-4">
			<div class="mx-2 md:mx-0">
				{#if showCollapsedSearch}
					<CollapsedSearchField onclick={expandSearch} />
				{/if}
				<SearchPane
					{mapProvider}
					cssClasses="pointer-events-auto"
					collapsed={showCollapsedSearch || hideSearchForMobilePlan}
					embedTripPlan={!mobilePlanSheetOpen}
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
						stop={selectedStopData}
						{closePane}
						{tripSelected}
						{handleUpdateRouteMap}
						{routeColors}
						bind:arrivalsAndDeparturesResponse={stopArrivals}
						bind:snap={sheetSnap}
					/>
				{:else if currentModal === Modal.ROUTE}
					<RouteModal {closePane} {mapProvider} {stops} {selectedRoute} bind:snap={sheetSnap} />
				{:else if currentModal === Modal.ALL_ROUTES}
					<ViewAllRoutesModal {closePane} {handleModalRouteClick} bind:snap={sheetSnap} />
				{:else if mobilePlanSheetOpen}
					<TripPlanModal
						{mapProvider}
						showForm={true}
						{handleTripPlan}
						{clearTripItineraries}
						itineraries={tripItineraries}
						error={tripPlanError}
						loading={loadingItineraries}
						closePane={closeMobilePlanSheet}
						bind:snap={sheetSnap}
					/>
				{:else if currentModal === Modal.TRIP_PLANNER}
					<TripPlanModal
						{mapProvider}
						itineraries={tripItineraries}
						error={tripPlanError}
						loading={loadingItineraries}
						closePane={closeTripPlanModal}
						bind:snap={sheetSnap}
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
		stop={selectedStopData}
		{handleStopMarkerSelect}
		{isRouteSelected}
		{showRouteMap}
		{initialCoords}
		{startInTripPlanMode}
		{activeRoutes}
		{routeColors}
		bind:mapProvider
	/>
{/if}
