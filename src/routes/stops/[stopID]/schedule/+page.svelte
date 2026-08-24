<script>
	import { page } from '$app/stores';
	import RouteScheduleTable from '$components/schedule-for-stop/RouteScheduleTable.svelte';
	import StopPageHeader from '$components/stops/StopPageHeader.svelte';
	import StandalonePage from '$components/StandalonePage.svelte';
	import { msToTimeString } from '$lib/dateTimeFormat.js';
	import Accordion from '$components/containers/Accordion.svelte';
	import AccordionItem from '$components/containers/AccordionItem.svelte';
	import { Datepicker } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import { t, isLoading } from 'svelte-i18n';
	import { getFirstDayOfWeek } from '$config/calendarConfig.js';

	let selectedDate = $state(new Date());
	let prevSelectedDate = $state(null);
	let emptySchedules = $state(false);
	let scheduleError = $state(false);
	let schedules = $state([]);
	let stopName = $state('');
	let stopId = $state('');
	let stopDirection = $state('');
	let accordionComponent = $state();
	let allRoutesExpanded = $state(false);

	let schedulesMap = new Map();
	let routeReference = new Map();
	let currentDate = new Date();

	stopId = $page.params.stopID;

	async function fetchScheduleForStop(stopId, date) {
		try {
			emptySchedules = false;
			scheduleError = false;
			const response = await fetch(`/api/oba/schedule-for-stop/${stopId}?date=${date}`);
			if (!response.ok) throw new Error('Failed to fetch schedule for stop');
			const scheduleForStop = await response.json();
			handleScheduleForStopResponse(scheduleForStop.data);
		} catch (error) {
			console.error('Error fetching schedules:', error);
			schedules = [];
			scheduleError = true;
		}
	}

	function retryScheduleFetch() {
		if (stopId && selectedDate) {
			fetchScheduleForStop(stopId, selectedDate.toISOString().split('T')[0]);
		}
	}

	function handleScheduleForStopResponse(scheduleForStop) {
		schedulesMap.clear();
		routeReference.clear();

		if (!scheduleForStop.entry.stopRouteSchedules.length) {
			emptySchedules = true;
			schedules = [];
			return;
		}

		setStopDetails(scheduleForStop.references.stops[0]);
		mapRoutes(scheduleForStop.references.routes);
		processRouteSchedules(scheduleForStop.entry.stopRouteSchedules);

		schedules = Array.from(schedulesMap.values());
	}

	function mapRoutes(routes) {
		for (let route of routes) {
			routeReference.set(route.id, route);
		}
	}

	function setStopDetails(stop) {
		stopName = stop.name;
		stopId = stop.id;
		stopDirection = stop.direction;
	}

	function processRouteSchedules(routeSchedules) {
		for (let routeSchedule of routeSchedules) {
			let routeId = routeSchedule.routeId;
			let stopRouteDirectionSchedules = routeSchedule.stopRouteDirectionSchedules;

			stopRouteDirectionSchedules.forEach((directionSchedule) => {
				const stopTimesGroupedByHour = groupStopTimesByHour(
					directionSchedule.scheduleStopTimes,
					directionSchedule.tripHeadsign
				);
				const routeName = getRouteName(routeId, directionSchedule.tripHeadsign);

				schedulesMap.set(routeName, {
					tripHeadsign: routeName,
					stopTimes: stopTimesGroupedByHour
				});
			});
		}
	}

	function getRouteName(routeId, tripHeadsign) {
		const route = routeReference.get(routeId);
		return `${route.shortName ?? route.longName} - ${tripHeadsign}`;
	}

	function groupStopTimesByHour(stopTimes, directionHeadsign) {
		const grouped = {};
		for (let stopTime of stopTimes) {
			const date = new Date(stopTime.arrivalTime);
			const hour = date.getHours();
			if (!grouped[hour]) grouped[hour] = [];

			// The direction headsign describes the route's usual destination. A stop-specific
			// headsign is supplied for trips that take a different path or terminate early.
			const destination = stopTime.stopHeadsign?.trim() || directionHeadsign;
			grouped[hour].push({
				arrivalTime: msToTimeString(stopTime.arrivalTime),
				destination,
				isShortLine: destination !== directionHeadsign
			});
		}
		return grouped;
	}

	function toggleAllRoutes() {
		if (allRoutesExpanded) {
			accordionComponent.closeAll();
		} else {
			accordionComponent.openAll();
		}
		allRoutesExpanded = !allRoutesExpanded;
	}

	onMount(async () => {
		if (stopId) {
			const formattedDate = currentDate.toISOString().split('T')[0];
			await fetchScheduleForStop(stopId, formattedDate);
		}
	});

	$effect(() => {
		if (selectedDate && selectedDate !== prevSelectedDate) {
			const formattedDate = selectedDate.toISOString().split('T')[0];
			prevSelectedDate = selectedDate;

			// we get an error if we try to fetch data on the server
			if (typeof window !== 'undefined') {
				fetchScheduleForStop(stopId, formattedDate);
			}
		}
	});
</script>

<svelte:head>
	<title>{stopName}{$isLoading ? '' : ` - ${$t('schedule_for_stop.route_schedules')}`}</title>
	{#if stopName}
		<link
			rel="manifest"
			href="/api/manifest?start=/stops/{encodeURIComponent(
				stopId
			)}/schedule&name={encodeURIComponent(stopName)}"
		/>
		<meta name="apple-mobile-web-app-capable" content="yes" />
		<meta name="apple-mobile-web-app-status-bar-style" content="default" />
		<meta name="apple-mobile-web-app-title" content={stopName} />
	{/if}
</svelte:head>

<StandalonePage>
	<StopPageHeader {stopName} {stopId} {stopDirection} />

	<div class="flex flex-col">
		<div class="flex flex-1 flex-col">
			<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
				{$isLoading ? '' : $t('schedule_for_stop.route_schedules')}
			</h2>

			<div class="mb-4 flex gap-4">
				<div class="z-20 min-w-32 md:w-[30%]">
					<Datepicker
						bind:value={selectedDate}
						inputClass="w-96"
						firstDayOfWeek={getFirstDayOfWeek()}
					/>
				</div>

				<div class="flex-1 text-right">
					<button class="button" onclick={toggleAllRoutes}>
						{$isLoading
							? ''
							: allRoutesExpanded
								? $t('schedule_for_stop.collapse_all_routes')
								: $t('schedule_for_stop.show_all_routes')}
					</button>
				</div>
			</div>

			<div
				class="flex-1 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-black"
			>
				{#if scheduleError}
					<div
						role="alert"
						class="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-10 text-center"
					>
						<p class="text-gray-700 dark:text-gray-300">
							{$isLoading ? '' : $t('schedule_for_stop.unable_to_load_schedule')}
						</p>
						<button class="button" onclick={retryScheduleFetch}>
							{$isLoading ? '' : $t('schedule_for_stop.retry')}
						</button>
					</div>
				{:else if emptySchedules}
					<p class="text-center text-gray-700 dark:text-gray-400">
						{$isLoading ? '' : $t('schedule_for_stop.no_schedules_available')}
					</p>
				{:else}
					<Accordion bind:this={accordionComponent}>
						{#each schedules as schedule}
							<AccordionItem>
								{#snippet header()}
									<span>{schedule.tripHeadsign}</span>
								{/snippet}
								<RouteScheduleTable {schedule} />
							</AccordionItem>
						{/each}
					</Accordion>
				{/if}
			</div>
		</div>
	</div>
</StandalonePage>
