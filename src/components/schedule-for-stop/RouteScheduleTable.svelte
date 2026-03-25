<script>
	import { t, isLoading } from 'svelte-i18n';
	import { convert24HourTo12Hour } from '$lib/dateTimeFormat';

	let { schedule } = $props();
	let hoveredTime = $state(null);

	function renderScheduleTable(schedule) {
		const stopTimes = Object.entries(schedule.stopTimes);
		const amTimes = stopTimes.filter(([hour]) => +hour < 12);
		const pmTimes = stopTimes.filter(([hour]) => +hour >= 12);
		return { amTimes, pmTimes };
	}

	function extractMinutes(arrivalTime) {
		return arrivalTime.split(':')[1].replace(/[^0-9]/g, '');
	}

	function getTooltip(stopTime) {
		if (!stopTime.isShortLine || !stopTime.stopHeadsign) return null;
		return `Ends at ${stopTime.stopHeadsign} — does not continue to ${schedule.mainHeadsign}`;
	}

	let hasAnyShortLine = $derived(
		Object.values(schedule.stopTimes).some(times => times.some(t => t.isShortLine))
	);
</script>

<div class="overflow-x-auto dark:bg-black">
	<table
		class="mt-4 w-full table-auto rounded-lg border border-gray-200 shadow-lg dark:border-gray-700 dark:bg-black"
	>
		<thead class="bg-gray-100 text-gray-800 dark:bg-gray-900">
			<tr>
				<th class="cursor-pointer px-6 py-3 text-left dark:text-white">
					{$isLoading ? '' : $t('schedule_for_stop.hour')}
				</th>
				<th class="cursor-pointer px-6 py-3 text-left dark:text-white">
					{$isLoading ? '' : $t('schedule_for_stop.minutes')}
				</th>
			</tr>
		</thead>
		<tbody>
			<tr class="bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600">
				<td colspan="2" class="px-6 py-3 font-semibold text-gray-700 dark:bg-gray-800 dark:text-white">AM</td>
			</tr>
			{#if renderScheduleTable(schedule).amTimes.length === 0}
				<tr>
					<td colspan="2" class="border px-6 py-3 text-center text-gray-500 dark:border-gray-700">
						{$isLoading ? '' : $t('schedule_for_stop.no_am_schedules_available')}
					</td>
				</tr>
			{:else}
				{#each renderScheduleTable(schedule).amTimes as [hour, times]}
					<tr class="hover:bg-gray-100 dark:hover:bg-gray-900">
						<td
							class="border px-6 py-3 text-center text-lg font-semibold dark:border-gray-700 dark:text-white"
						>
							{convert24HourTo12Hour(hour)}
							<span class="text-sm text-gray-600 dark:text-gray-100">AM</span>
						</td>
						<td class="relative flex flex-wrap items-start gap-3 border px-6 py-3 text-lg dark:border-gray-700 dark:text-white">
							{#each times as stopTime, index (index)}
								{#if stopTime.isShortLine}
									<span
										class="relative cursor-help rounded bg-amber-100 px-2 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
										on:mouseenter={() => (hoveredTime = `${hour}_${index}`)}
										on:mouseleave={() => (hoveredTime = null)}
									>
											{extractMinutes(stopTime.arrivalTime)}<sup class="text-amber-600 dark:text-amber-300">†</sup>
										{#if hoveredTime === `${hour}_${index}`}
											<div
												class="absolute bottom-full left-0 z-50 mb-2 whitespace-nowrap rounded bg-gray-900 px-3 py-1 text-xs text-white shadow-lg dark:bg-gray-700"
											>
												{getTooltip(stopTime)}
												<div class="absolute top-full left-2 h-0 w-0 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"
												></div>
											</div>
										{/if}
									</span>
								{:else}
									<span class="rounded bg-gray-50 px-2 dark:bg-gray-800">
										{extractMinutes(stopTime.arrivalTime)}
									</span>
								{/if}
							{/each}
						</td>
					</tr>
				{/each}
			{/if}

			<tr class="bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-900">
				<td colspan="2" class="px-6 py-3 font-semibold text-gray-700 dark:bg-gray-800 dark:text-white">PM</td>
			</tr>
			{#if renderScheduleTable(schedule).pmTimes.length === 0}
				<tr>
					<td colspan="2" class="border px-6 py-3 text-center text-gray-500">
						{$isLoading ? '' : $t('schedule_for_stop.no_pm_schedules_available')}
					</td>
				</tr>
			{:else}
				{#each renderScheduleTable(schedule).pmTimes as [hour, times]}
					<tr class="hover:bg-gray-100 dark:hover:bg-gray-800">
						<td
							class="border px-6 py-3 text-center text-lg font-semibold dark:border-gray-700 dark:text-white"
						>
							{convert24HourTo12Hour(hour)}
							<span class="text-sm text-gray-600 dark:text-gray-100">PM</span>
						</td>
						<td class="relative flex flex-wrap items-start gap-3 border px-6 py-3 text-lg dark:border-gray-700 dark:text-white">
							{#each times as stopTime, index (index)}
								{#if stopTime.isShortLine}
									<span
										class="relative cursor-help rounded bg-amber-100 px-2 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
										on:mouseenter={() => (hoveredTime = `${hour}_${index}`)}
										on:mouseleave={() => (hoveredTime = null)}
									>
										{extractMinutes(stopTime.arrivalTime)}<sup class="text-amber-600 dark:text-amber-300">†</sup>
										{#if hoveredTime === `${hour}_${index}`}
											<div
												class="absolute bottom-full left-0 z-50 mb-2 whitespace-nowrap rounded bg-gray-900 px-3 py-1 text-xs text-white shadow-lg dark:bg-gray-700"
											>
												{getTooltip(stopTime)}
												<div class="absolute top-full left-2 h-0 w-0 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"
												></div>
											</div>
										{/if}
									</span>
								{:else}
									<span class="rounded bg-gray-50 px-2 dark:bg-gray-800">
										{extractMinutes(stopTime.arrivalTime)}
									</span>
								{/if}
							{/each}
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>

	{#if hasAnyShortLine}
		<div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			<span class="inline-block rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
				12<sup class="text-amber-600 dark:text-amber-300">†</sup>
			</span>
			Ends before final destination — tap/hover for details
		</div>
	{/if}
</div>
