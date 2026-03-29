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
	let selectedTime = $state('');
	let prevSelectedDate = $state(null);
	let prevSelectedTime = $state(null);
	let emptySchedules = $state(false);
	let schedules = $state([]);
	let allSchedules = $state([]); // Store unfiltered schedules
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
			const response = await fetch(`/api/oba/schedule-for-stop/${stopId}?date=${date}`);
			if (!response.ok) throw new Error('Failed to fetch schedule for stop');
			const scheduleForStop = await response.json();
			handleScheduleForStopResponse(scheduleForStop.data);
		} catch (error) {
			console.error('Error fetching schedules:', error);
		}
	}

	function handleScheduleForStopResponse(scheduleForStop) {
		schedulesMap.clear();
		routeReference.clear();

		if (!scheduleForStop.entry.stopRouteSchedules.length) {
			emptySchedules = true;
			allSchedules = [];
			schedules = [];
			return;
		}

		setStopDetails(scheduleForStop.references.stops[0]);
		mapRoutes(scheduleForStop.references.routes);
		processRouteSchedules(scheduleForStop.entry.stopRouteSchedules);

		allSchedules = Array.from(schedulesMap.values());
		filterSchedulesByTime();
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
				const stopTimesGroupedByHour = groupStopTimesByHour(directionSchedule.scheduleStopTimes);
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

	function groupStopTimesByHour(stopTimes) {
		const grouped = {};
		for (let stopTime of stopTimes) {
			const date = new Date(stopTime.arrivalTime);
			const hour = date.getHours();
			if (!grouped[hour]) grouped[hour] = [];
			grouped[hour].push({
				arrivalTime: msToTimeString(stopTime.arrivalTime),
				timestamp: stopTime.arrivalTime // Store for time filtering
			});
		}
		return grouped;
	}

	function filterSchedulesByTime() {
		if (!selectedTime || !allSchedules.length) {
			schedules = allSchedules;
			emptySchedules = allSchedules.length === 0;
			return;
		}
		const [hourPart, minutePart] = selectedTime.split(':');
		const selectedHour = parseInt(hourPart, 10);
		const selectedMinute = minutePart !== undefined ? parseInt(minutePart, 10) : 0;
		const selectedTotalMinutes = selectedHour * 60 + selectedMinute;

		schedules = allSchedules
			.map((schedule) => {
				const filteredEntries = Object.entries(schedule.stopTimes)
					.map(([hour, times]) => {
						const hourNum = parseInt(hour, 10);
						if (Number.isNaN(hourNum)) return null;
						if (hourNum < selectedHour) return null;
						if (hourNum > selectedHour) return [hour, times];
						const filteredTimes = times.filter((timeObj) => {
							const date = new Date(timeObj.timestamp);
							const totalMinutes = date.getHours() * 60 + date.getMinutes();
							return totalMinutes >= selectedTotalMinutes;
						});
						return filteredTimes.length ? [hour, filteredTimes] : null;
					})
					.filter((entry) => entry !== null);
				return { ...schedule, stopTimes: Object.fromEntries(filteredEntries) };
			})
			.filter((schedule) => Object.keys(schedule.stopTimes).length > 0);
		emptySchedules = schedules.length === 0;
	}

	function setTimeAndRefetch(time) {
		selectedTime = time;
	}

	function setShortcut(date, time) {
		selectedDate = date;
		selectedTime = time;
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

			// Set default time to current time
			const now = new Date();
			selectedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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

	$effect(() => {
		if (selectedTime !== prevSelectedTime) {
			prevSelectedTime = selectedTime;
			filterSchedulesByTime();
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
			<h2 class="mb-4 text-2xl font-bold text-gray-800">
				{$isLoading ? '' : $t('schedule_for_stop.route_schedules')}
			</h2>

			<!-- Date and Time Picker Controls -->
			<div class="mb-6 flex flex-col gap-4">
				<!-- Date and Time Input Row -->
				<div class="flex flex-col gap-4 md:flex-row md:items-end">
					<div class="shrink-0">
						<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Date
						</label>
						<div class="z-20 min-w-32 md:w-[200px]">
							<Datepicker
								bind:value={selectedDate}
								inputClass="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700"
								firstDayOfWeek={getFirstDayOfWeek()}
							/>
						</div>
					</div>

					<div>
						<label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Time
						</label>
						<input
							type="time"
							bind:value={selectedTime}
							class="rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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

				<!-- Quick Shortcut Buttons -->
				<div class="flex flex-wrap gap-2">
					<button
						class="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
						onclick={() => {
							const now = new Date();
							// Set date to today (midnight)
							selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
							// Set time to current hour:minute
							const hours = String(now.getHours()).padStart(2, '0');
							const minutes = String(now.getMinutes()).padStart(2, '0');
							selectedTime = `${hours}:${minutes}`;
						}}
					>
						Now
					</button>
					<button
						class="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
						onclick={() => {
							const tomorrow = new Date();
							tomorrow.setDate(tomorrow.getDate() + 1);
							selectedDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
							selectedTime = '08:00';
						}}
					>
						Tomorrow @ 8am
					</button>
					<button
						class="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700"
						onclick={() => {
							const tomorrow = new Date();
							tomorrow.setDate(tomorrow.getDate() + 1);
							selectedDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
							selectedTime = '18:00';
						}}
					>
						Tomorrow @ 6pm
					</button>
				</div>
			</div>

			<div
				class="flex-1 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-black"
			>
				{#if emptySchedules}
					<p class="text-center text-gray-700 dark:text-gray-400">
						{#if selectedTime}
							{$isLoading ? '' : $t('schedule_for_stop.no_departures_after_time', { date: selectedDate.toLocaleDateString(), time: selectedTime })}
						{:else}
							{$isLoading ? '' : $t('schedule_for_stop.no_schedules_available')}
						{/if}
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
