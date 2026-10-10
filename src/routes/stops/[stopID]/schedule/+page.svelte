<script lang="ts">
	import { env } from '$env/dynamic/public';
	import RouteScheduleTable from '$components/schedule-for-stop/RouteScheduleTable.svelte';
	import StopPageHeader from '$components/stops/StopPageHeader.svelte';
	import StandalonePage from '$components/StandalonePage.svelte';
	import {
		dateToServiceDay,
		fetchScheduleForStop,
		getRouteSchedules,
		type RouteSchedule,
		serviceDayToDate
	} from '$lib/scheduleForStop';
	import Accordion from '$components/containers/Accordion.svelte';
	import AccordionItem from '$components/containers/AccordionItem.svelte';
	import Datepicker from 'flowbite-svelte/Datepicker.svelte';
	import { t, isLoading } from 'svelte-i18n';
	import { getFirstDayOfWeek } from '$config/calendarConfig.js';
	import Skeleton from '$components/Skeleton.svelte';

	let { data } = $props();

	const regionTz = env.PUBLIC_OBA_TIMEZONE || undefined;

	// Today's schedules come from the server, already grouped. Other dates
	// replace them here in the browser only, so a refresh always starts from today.
	let selectedDate: Date | null = $derived(serviceDayToDate(data.serviceDay));

	// Null when a request for another date fails.
	let schedules: RouteSchedule[] | null = $derived(data.schedules);
	let loading = $state(false);
	let accordionComponent: Accordion | null = $state(null);
	let allRoutesExpanded = $state(false);

	// Aborted when a newer date is requested so a slow response for an older
	// date can't overwrite the current one.
	let scheduleRequestController: AbortController | null = null;

	// New `data` (another stop) resets the date and schedule above, so a date
	// still loading for the old data is stale. Leaving the page cancels it too.
	$effect(() => {
		void data;
		return () => {
			scheduleRequestController?.abort();
			loading = false;
		};
	});

	// The stop doesn't vary by date, so it comes from the server's data, which a
	// failed request for another date can't clear.
	const stop = $derived(data.stop);
	const stopId = $derived(data.stopId);

	function selectDate(date: Date | null) {
		selectedDate = date;
		// Null when the picker is cleared; keep showing the last schedule.
		if (date) {
			loadSchedule(dateToServiceDay(date));
		}
	}

	async function loadSchedule(serviceDay: string) {
		scheduleRequestController?.abort();
		const requestController = new AbortController();
		scheduleRequestController = requestController;
		loading = true;
		try {
			const result = await fetchScheduleForStop(fetch, stopId, serviceDay, {
				signal: requestController.signal
			});
			if (!requestController.signal.aborted) schedules = getRouteSchedules(result, regionTz);
		} catch (error) {
			if (requestController.signal.aborted) return;
			console.error('Error fetching schedules:', error);
			// Don't leave the previous date's schedules looking current.
			schedules = null;
		} finally {
			if (scheduleRequestController === requestController) {
				loading = false;
			}
		}
	}

	function toggleAllRoutes() {
		if (!accordionComponent) return;

		if (allRoutesExpanded) accordionComponent.closeAll();
		else accordionComponent.openAll();
		allRoutesExpanded = !allRoutesExpanded;
	}
</script>

<svelte:head>
	<title>{stop.name}{$isLoading ? '' : ` - ${$t('schedule_for_stop.route_schedules')}`}</title>
	<link
		rel="manifest"
		href="/api/manifest?start=/stops/{encodeURIComponent(stopId)}/schedule&name={encodeURIComponent(
			stop.name
		)}"
	/>
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content={stop.name} />
</svelte:head>

<StandalonePage>
	<StopPageHeader
		stopName={stop.name}
		{stopId}
		stopDirection={stop.direction}
		stopLat={stop.lat}
		stopLon={stop.lon}
		stopCode={stop.code}
	/>

	<div class="flex flex-col">
		<div class="flex flex-1 flex-col">
			<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
				{$isLoading ? '' : $t('schedule_for_stop.route_schedules')}
			</h2>

			<div class="mb-4 flex gap-4">
				<div class="z-20 min-w-32 md:w-[30%]">
					<Datepicker
						bind:value={() => selectedDate, selectDate}
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
				aria-busy={loading}
				class="flex-1 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-black"
			>
				{#if schedules?.length}
					<!-- While another date loads, these stay in place, dimmed, until its schedules arrive. -->
					<div
						class="transition-opacity {loading ? 'opacity-50' : ''}"
						data-testid="route-schedules"
						inert={loading}
					>
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
					</div>
				{:else if loading}
					<Accordion>
						<Skeleton class="h-12 rounded-none" />
					</Accordion>
				{:else if !schedules}
					<!-- Only a failed request for another date leaves no schedule. -->
					<p role="alert" class="text-center text-red-600 dark:text-red-400">
						{$isLoading ? '' : $t('schedule_for_stop.schedules_load_failed')}
					</p>
				{:else}
					<p class="text-center text-gray-700 dark:text-gray-400">
						{$isLoading ? '' : $t('schedule_for_stop.no_schedules_available')}
					</p>
				{/if}
			</div>
		</div>
	</div>
</StandalonePage>
