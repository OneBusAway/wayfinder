<script lang="ts">
	import * as Tabs from '$components/ui/tabs';
	import { Button } from '$components/ui/button';
	import SearchField from '$components/search/SearchField.svelte';
	import SearchResultItem from '$components/search/SearchResultItem.svelte';
	import { onMount, onDestroy, tick } from 'svelte';
	import { prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { MapPin, Signpost, X } from '@lucide/svelte';
	import { t } from 'svelte-i18n';
	import { clearVehicleMarkersMap, fetchAndUpdateVehicles } from '$lib/vehicleUtils';
	import { calculateMidpoint } from '$lib/mathUtils';
	import { env } from '$env/dynamic/public';
	import TripPlan from '$components/trip-planner/TripPlan.svelte';
	import { isMapLoaded } from '$src/stores/mapStore';
	import { answeredSurveys, surveyStore } from '$stores/surveyStore';
	import { removeAgencyPrefix, stopSubtitle } from '$lib/utils';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { parseTripParams, hasTripParams, clearTripUrl } from '$lib/urlState';
	import { notifyRouteLoadFailed, notifyPartialRouteShape } from '$lib/routeNotifications';
	import { notifications } from '$stores/notificationStore';
	import type { Snippet } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';
	import type {
		GeocodingResult,
		MapProvider,
		SearchResults,
		Stop,
		TripPlanResponse
	} from '$lib/types';
	import type { RoutesForLocationListResponse } from 'onebusaway-sdk/resources/routes-for-location';
	import type { References } from 'onebusaway-sdk/resources/shared';
	import type { StopsForRouteListResponse } from 'onebusaway-sdk/resources/stops-for-route';

	type Route = RoutesForLocationListResponse.Data.List;

	// The SDK types each stop grouping as holding `stopIds` directly, but the API
	// nests them under `stopGroups`.
	interface StopGrouping {
		stopGroups?: ({ stopIds: string[] } | null)[];
	}

	interface StopsForRouteResponse {
		data: Omit<StopsForRouteListResponse.Data, 'entry'> & {
			entry: Omit<StopsForRouteListResponse.Data.Entry, 'stopGroupings'> & {
				stopGroupings?: StopGrouping[];
			};
		};
	}

	interface RouteData {
		currentIntervalId: number | null;
		polylines: Polyline[];
		route: Route;
		stops: References.Stop[];
	}

	type Polyline = NonNullable<Awaited<ReturnType<MapProvider['createPolyline']>>>;

	interface Props {
		childContent: Snippet;
		clearTripItineraries: () => void;
		collapsed?: boolean;
		cssClasses?: string;
		embedTripPlan?: boolean;
		handleMapStopMarkerSelect?: ((stop: Stop) => void) | null;
		handleRouteSelected: (routeData: RouteData) => void;
		handleStopMarkerSelect: (stop: Stop) => void;
		handleTripPlan: (tripPlanData: { data: TripPlanResponse }) => void;
		handleViewAllRoutes: () => void;
		mapProvider: MapProvider;
		onCollapse?: (() => void) | null;
	}

	let {
		handleRouteSelected,
		handleViewAllRoutes,
		handleStopMarkerSelect,
		// For taps on the marker this pane drops on the map. Unlike picking a search
		// result, a map tap must not replace an already-open stop.
		handleMapStopMarkerSelect = null,
		handleTripPlan,
		clearTripItineraries,
		cssClasses = '',
		mapProvider,
		onCollapse = null,
		collapsed = false,
		// When false, Plan tab stays available but TripPlan mounts elsewhere
		// (mobile bottom sheet). Avoids two TripPlan instances.
		embedTripPlan = true,
		childContent
	}: Props = $props();

	let routes = $state<Route[] | null>(null);
	let stops = $state<Stop[] | null>(null);
	let location = $state<GeocodingResult | null>(null);
	let query = $state<string | null>(null);
	let polylines: Polyline[] = [];
	let currentIntervalId: number | null = null;
	// Bumped on every route click so a slower, superseded load can detect a newer
	// click took over (after one of its awaits) and bail instead of fighting the
	// newer route for the camera, stop markers, and vehicle polling.
	let routeLoadToken = 0;
	// Id of the toast the current route load raised, so we only ever clear our
	// own and never one owned by another component.
	let notificationId: number | null = null;
	let mapLoaded = $state(false);
	let isSurveyAnswered = $state(false);
	let activeTab = $state('stops');
	let isContextMenuTrigger = false;

	function handleLocationClick(location: GeocodingResult) {
		clearResults();
		const lat = location.geometry.location.lat;
		const lng = location.geometry.location.lng;
		mapProvider.panTo(lat, lng);
		mapProvider.setZoom(20);
	}

	function handleStopClick(stop: Stop) {
		clearResults();

		const markerOptions = {
			stop: stop,
			position: { lat: stop.lat, lng: stop.lon },
			onClick: () => (handleMapStopMarkerSelect ?? handleStopMarkerSelect)(stop)
		};
		mapProvider.addMarker(markerOptions);
		mapProvider.flyTo(stop.lat, stop.lon, 20);

		setTimeout(() => {
			handleStopMarkerSelect(stop);
		}, 100);
	}

	/**
	 * Extracts and deduplicates stops from the OBA API stopGroupings structure.
	 * Iterates through the nested stopGroupings to build a flat, ordered list of unique stops.
	 * Maintains the order of stops as they appear in the groupings while preventing duplicates.
	 *
	 * @param stopGroupings - Array of stop grouping objects from the OBA API, where each grouping
	 * 						  contains stopGroups with arrays of stopIds
	 * @param stopsMap - Map of stop IDs to stop objects for quick lookups
	 * @returns Ordered array of unique stop objects
	 */
	function extractOrderedStops(
		stopGroupings: StopGrouping[] | undefined,
		stopsMap: Map<string, References.Stop>
	): References.Stop[] {
		if (!stopGroupings) return [];
		if (stopGroupings.length === 0) return [];

		let orderedStops: References.Stop[] = [];
		// local to this function
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		let seenStopIds = new Set<string>();

		stopGroupings.forEach((grouping) => {
			if (!grouping.stopGroups || grouping.stopGroups.length === 0) return;

			grouping.stopGroups.forEach((group) => {
				if (!group || group.stopIds.length === 0) return;

				group.stopIds.forEach((stopId) => {
					if (!seenStopIds.has(stopId)) {
						const stop = stopsMap.get(stopId);
						if (stop) {
							orderedStops.push(stop);
							seenStopIds.add(stopId);
						}
					}
				});
			});
		});

		return orderedStops;
	}

	async function handleRouteClick(route: Route) {
		const loadToken = ++routeLoadToken;
		// Drop our prior retriable toast so a stale Retry for a previous route
		// can't wipe markers/polylines after the user has moved on.
		notifications.dismiss(notificationId);
		notificationId = null;
		mapProvider.clearAllPolylines();
		mapProvider.removeStopMarkers();
		mapProvider.clearVehicleMarkers();
		clearVehicleMarkersMap();
		clearResults();
		try {
			const response = await fetch(`/api/oba/stops-for-route/${route.id}`);
			if (loadToken !== routeLoadToken) return;

			if (!response.ok) {
				console.error(`Failed to fetch route data: ${response.status}`);
				notificationId = notifyRouteLoadFailed(() => handleRouteClick(route));
				return;
			}

			const stopsForRoute: StopsForRouteResponse = await response.json();
			if (loadToken !== routeLoadToken) return;

			const stopsMap = new Map(stopsForRoute.data.references.stops.map((stop) => [stop.id, stop]));
			const polylinesData = stopsForRoute.data.entry.polylines;

			const stopGroupings = stopsForRoute.data.entry.stopGroupings;
			let orderedStops = extractOrderedStops(stopGroupings, stopsMap);

			if (orderedStops.length === 0) {
				orderedStops = stopsForRoute.data.references.stops;
			}

			// Draw the route shapes first so the view can fit their full extent.
			// Reset the collection so each route click rebuilds it from scratch
			// rather than accumulating stale references from previous selections.
			polylines = [];
			const segmentCount = polylinesData?.length ?? 0;
			for (const polylineData of polylinesData!) {
				const polyline = await mapProvider.createPolyline(polylineData.points);
				if (loadToken !== routeLoadToken) return;
				// createPolyline returns null for an undecodable shape (on either
				// provider); skip it so one bad segment degrades the route instead
				// of leaving a null hole in the polylines array.
				if (polyline) polylines.push(polyline);
			}

			if (loadToken !== routeLoadToken) return;

			if (segmentCount > 0 && polylines.length < segmentCount) {
				notificationId = notifyPartialRouteShape();
			}

			// Fit the view to the full route so it's always centered and visible
			// regardless of route length. Fall back to the stops' midpoint when no
			// polyline could be drawn. Awaiting the fit lets the stop markers appear
			// in sync with the route reveal instead of popping in beforehand.
			const fitted = await mapProvider.fitToPolylines?.();
			// A newer route click took over while the camera was settling; leave the
			// map to that newer load instead of yanking it back to this route.
			if (loadToken !== routeLoadToken) return;
			if (!fitted) {
				const midpoint = calculateMidpoint(orderedStops);
				if (midpoint) {
					mapProvider.flyTo(midpoint.lat, midpoint.lon, 12);
				}
			}

			await showStopsOnRoute(orderedStops);
			if (loadToken !== routeLoadToken) return;
			// Clear any existing interval first to prevent memory leaks
			if (currentIntervalId) {
				clearInterval(currentIntervalId);
				currentIntervalId = null;
			}
			const intervalId = await fetchAndUpdateVehicles(route.id, mapProvider, route.type);
			if (loadToken !== routeLoadToken) {
				// Superseded while polling was starting; tear down this stale
				// interval rather than overwriting the newer load's id.
				clearInterval(intervalId);
				return;
			}
			currentIntervalId = intervalId;

			const routeData = {
				route,
				stops: orderedStops,
				polylines,
				currentIntervalId
			};

			handleRouteSelected(routeData);
		} catch (error) {
			console.error('Error fetching route data:', error);
			if (loadToken === routeLoadToken) {
				notificationId = notifyRouteLoadFailed(() => handleRouteClick(route));
			}
		}
	}

	async function showStopsOnRoute(stops: References.Stop[]) {
		for (const stop of stops) {
			mapProvider.addStopRouteMarker(stop, null);
		}
	}

	function handleSearchResults(results: SearchResults) {
		routes = results.routes;
		stops = results.stops;
		location = results.location;
		query = results.query;
	}

	function clearResults() {
		if (polylines) {
			mapProvider.clearAllPolylines();
		}
		routes = null;
		stops = null;
		location = null;
		query = null;

		clearVehicleMarkersMap();
		mapProvider.clearVehicleMarkers();
		clearInterval(currentIntervalId ?? undefined);
		currentIntervalId = null;
	}

	function handlePlanTripTabClick() {
		const event = new CustomEvent('planTripTabClicked');
		window.dispatchEvent(event);
	}

	function handleTabChange(value: string) {
		switch (value) {
			case 'plan':
				handlePlanTripTabClick();
				break;
			case 'stops':
				handleTabSwitch();
				break;
			default:
				throw new Error(`Unknown tab ${value}`);
		}
		activeTab = value;
	}

	function handleTabSwitch() {
		if (isContextMenuTrigger) return;

		if (activeTab === 'plan') {
			window.dispatchEvent(new CustomEvent('tripPlanModalClosed'));
			clearTripItineraries();
			clearTripUrl();
		}
		const event = new CustomEvent('tabSwitched');
		window.dispatchEvent(event);
	}

	$effect(() => {
		if ($surveyStore && $surveyStore.id) {
			isSurveyAnswered = $answeredSurveys[$surveyStore.id] === true;
		} else {
			isSurveyAnswered = false;
		}
	});

	let unsubscribeMapLoaded: Unsubscriber | undefined;

	function handleRouteSelectedFromModal(event: CustomEvent<{ route: Route }>) {
		handleRouteClick(event.detail.route);
	}

	async function handleContextMenuTripPlan(
		e: CustomEvent<{ lat: number; lng: number; type: 'from' | 'to' }>
	) {
		isContextMenuTrigger = true;
		activeTab = 'plan';
		try {
			await tick();
			// Enter trip-plan mode the same way a Plan tab click does (mobile sheet,
			// map chrome).
			window.dispatchEvent(new CustomEvent('planTripTabClicked'));
			// On mobile, TripPlan remounts inside the plan sheet after this event —
			// wait one tick so its listeners exist before setTripPlanLocation.
			await tick();
			window.dispatchEvent(new CustomEvent('setTripPlanLocation', { detail: e.detail }));
		} finally {
			isContextMenuTrigger = false;
		}
	}

	function handleOpenStopsTab() {
		if (isContextMenuTrigger || activeTab !== 'plan') return;
		handleTabSwitch();
		activeTab = 'stops';
	}

	let hasRestoredSharedTrip = false;

	// Restore a trip shared via the URL. Waits for the map so TripPlan can drop
	// pins, then opens the Plan tab and hands the parsed trip to TripPlan. The
	// parsed trip is captured up front because planTripTabClicked resets the URL
	// to "/" (the planned trip rewrites it once the itinerary loads). Wrapped in
	// try/catch since this runs from an isMapLoaded subscription callback with no
	// caller to report failures to.
	async function maybeRestoreSharedTrip() {
		if (hasRestoredSharedTrip || !env.PUBLIC_OTP_SERVER_URL) return;

		const searchParams = $page.url.searchParams;
		const trip = parseTripParams(searchParams);

		// "from"/"to" present but unparsable (truncated, corrupted, out of range):
		// tell the recipient the link didn't work instead of silently falling
		// back to the default map with no explanation.
		if (!trip && !hasTripParams(searchParams)) return;

		hasRestoredSharedTrip = true;
		try {
			activeTab = 'plan';
			// tick() also lets the Plan tab mount so TripPlan's loadSharedTrip /
			// invalidSharedTrip listeners are registered before either is dispatched.
			await tick();
			// Mirror a real Plan tab click so the map hides stop markers and enters
			// trip-plan mode. Dispatched after tick so MapView's listener is ready.
			window.dispatchEvent(new CustomEvent('planTripTabClicked'));
			// On mobile, TripPlan remounts inside the plan sheet after this event —
			// wait one more tick so its listeners exist before loadSharedTrip.
			await tick();
			if (trip) {
				window.dispatchEvent(new CustomEvent('loadSharedTrip', { detail: trip }));
			} else {
				window.dispatchEvent(new CustomEvent('invalidSharedTrip'));
			}
		} catch (error) {
			console.error('Failed to restore shared trip from URL:', error);
		}
	}

	onMount(() => {
		unsubscribeMapLoaded = isMapLoaded.subscribe((value) => {
			mapLoaded = value;
			if (value && mapProvider) {
				maybeRestoreSharedTrip();
			}
		});

		window.addEventListener('routeSelectedFromModal', handleRouteSelectedFromModal);
		window.addEventListener('contextMenuTripPlan', handleContextMenuTripPlan);
		window.addEventListener('openStopsTab', handleOpenStopsTab);
	});

	onDestroy(() => {
		notifications.dismiss(notificationId);
		if (unsubscribeMapLoaded) {
			unsubscribeMapLoaded();
		}
		if (browser) {
			window.removeEventListener('routeSelectedFromModal', handleRouteSelectedFromModal);
			window.removeEventListener('contextMenuTripPlan', handleContextMenuTripPlan);
			window.removeEventListener('openStopsTab', handleOpenStopsTab);
		}
		if (currentIntervalId) {
			clearInterval(currentIntervalId);
			currentIntervalId = null;
		}
	});
</script>

<!-- Collapsing hides the pane below md only (a floating stand-in field takes its
     place there); md and up always shows it, so `collapsed` restores this root's
     own flex display at that breakpoint. -->
<div
	class={`modal-pane flex flex-col justify-between bg-white/80 backdrop-blur-xs md:w-96 dark:bg-surface-dark ${collapsed ? 'hidden md:flex' : ''} ${cssClasses}`}
>
	<Tabs.Root bind:value={() => activeTab, handleTabChange} class="pb-4">
		<div class="flex items-center justify-between border-b">
			<Tabs.List variant="line">
				<Tabs.Trigger value="stops">
					{$t('tabs.stops-and-stations')}
				</Tabs.Trigger>
				{#if env.PUBLIC_OTP_SERVER_URL}
					<Tabs.Trigger value="plan" disabled={!mapLoaded}>
						{$t('tabs.plan_trip')}
					</Tabs.Trigger>
				{/if}
			</Tabs.List>

			{#if onCollapse}
				<!-- Collapsing to the floating pill is a sub-md affordance; on wider
				     viewports the pane always stays open. -->
				<Button onclick={onCollapse} class="md:hidden" size="icon-sm" variant="secondary">
					<X class="h-4 w-4 font-black text-black dark:text-white" />
					<span class="sr-only">{$t('search.collapse')}</span>
				</Button>
			{/if}
		</div>

		<Tabs.Content value="stops">
			<SearchField value={query} {handleSearchResults} />

			{#if !isSurveyAnswered && $surveyStore}
				<div class="mt-2">
					{@render childContent()}
				</div>
			{/if}

			{#if query}
				<p class="text-sm text-gray-700 dark:text-gray-400">
					{$t('search.results_for')} "{query}".
					<button type="button" onclick={clearResults} class="text-blue-600 hover:underline">
						{$t('search.clear_results')}
					</button>
				</p>
			{/if}

			<div class="max-h-96 overflow-y-auto">
				{#if location}
					<SearchResultItem
						onclick={() => handleLocationClick(location!)}
						title={location.formatted_address}
						icon={MapPin}
						subtitle={location?.types?.join(', ') || location.name}
					/>
				{/if}
				{#if routes?.length}
					{#each routes as route (route.id)}
						<SearchResultItem
							onclick={() => handleRouteClick(route)}
							icon={prioritizedRouteTypeForDisplay(route.type)}
							title={`${$t('route')} ${removeAgencyPrefix(route.nullSafeShortName || route.id)}`}
							subtitle={route.description}
						/>
					{/each}
				{/if}
				{#if stops?.length}
					{#each stops as stop (stop.id)}
						<SearchResultItem
							onclick={() => handleStopClick(stop)}
							icon={Signpost}
							title={stop.name}
							subtitle={stopSubtitle(stop, $t)}
						/>
					{/each}
				{/if}
			</div>

			<div class="mt-0 sm:mt-0">
				<button
					type="button"
					class="mt-3 text-sm font-medium text-brand-accent underline hover:text-brand focus:outline-hidden dark:text-brand dark:hover:text-white"
					onclick={handleViewAllRoutes}
				>
					{$t('search.click_here')}
				</button>
				<span class="text-sm font-medium text-black dark:text-white">
					{$t('search.for_a_list_of_available_routes')}</span
				>
			</div>
		</Tabs.Content>

		{#if env.PUBLIC_OTP_SERVER_URL}
			<Tabs.Content value="plan">
				<!-- Mount TripPlan only while its tab is open: it registers window
				     listeners on mount, and shared-trip restore waits for that. -->
				{#if embedTripPlan && activeTab === 'plan'}
					<TripPlan {mapProvider} {handleTripPlan} {clearTripItineraries} />
				{/if}
			</Tabs.Content>
		{/if}
	</Tabs.Root>
</div>
