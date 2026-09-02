<script>
	import { t, isLoading } from 'svelte-i18n';
	import { convert24HourTo12Hour } from '$lib/dateTimeFormat';

	let { schedule } = $props();

	/** Unique per instance so multiple expanded route tables don't share one */
	/** caption id (aria-labelledby would otherwise resolve to the first table). */
	const captionId = `schedule-table-caption-${crypto.randomUUID()}`;

	let scheduleData = $derived(renderScheduleTable(schedule));
	let hasShortLines = $derived(
		Object.values(schedule.stopTimes).some((times) =>
			times.some((stopTime) => stopTime.isShortLine)
		)
	);

	function renderScheduleTable(schedule) {
		const stopTimes = Object.entries(schedule.stopTimes);

		const amTimes = stopTimes.filter(([hour]) => +hour < 12);
		const pmTimes = stopTimes.filter(([hour]) => +hour >= 12);

		return {
			amTimes,
			pmTimes
		};
	}

	function extractMinutes(arrivalTime) {
		return arrivalTime.replace(/[AP]M/, '').split(':')[1];
	}
</script>

<!-- A focusable scroll container gives keyboard users an entry point to the
	scrollable schedule table; role="region" + aria-labelledby name it via the caption. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div role="region" tabindex="0" aria-labelledby={captionId} class="overflow-x-auto dark:bg-black">
	{#if hasShortLines}
		<p
			class="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
		>
			<span
				class="mt-0.5 shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-950 dark:bg-amber-800 dark:text-amber-50"
			>
				{$isLoading ? '' : $t('schedule_for_stop.short_line')}
			</span>
			<span>{$isLoading ? '' : $t('schedule_for_stop.short_line_notice')}</span>
		</p>
	{/if}
	<table
		class="mt-4 w-full table-auto rounded-lg border border-gray-200 shadow-lg dark:border-gray-700 dark:bg-black"
	>
		<caption id={captionId} class="sr-only">
			{$isLoading
				? ''
				: $t('schedule_for_stop.schedule_table_caption', {
						values: { route: schedule.tripHeadsign }
					})}
		</caption>
		<thead class="bg-gray-100 text-gray-800 dark:bg-gray-900">
			<tr>
				<th scope="col" class="px-6 py-3 text-left dark:text-white"
					>{$isLoading ? '' : $t('schedule_for_stop.hour')}</th
				>
				<th scope="col" class="px-6 py-3 text-left dark:text-white"
					>{$isLoading ? '' : $t('schedule_for_stop.minutes')}</th
				>
			</tr>
		</thead>
		<tbody>
			<tr class="bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600">
				<th
					colspan="2"
					scope="rowgroup"
					class="px-6 py-3 text-left font-semibold text-gray-700 dark:bg-gray-800 dark:text-white"
					>AM</th
				>
			</tr>
			{#if scheduleData.amTimes.length === 0}
				<tr>
					<td colspan="2" class="border px-6 py-3 text-center text-gray-500 dark:border-gray-700">
						{$isLoading ? '' : $t('schedule_for_stop.no_am_schedules_available')}
					</td>
				</tr>
			{:else}
				{#each scheduleData.amTimes as [hour, times]}
					<tr class="hover:bg-gray-100 dark:hover:bg-gray-900">
						<td
							class="border px-6 py-3 text-center text-lg font-semibold dark:border-gray-700 dark:text-white"
							title="Full Time: {hour}:{extractMinutes(times[0].arrivalTime)}"
						>
							{convert24HourTo12Hour(hour)}
							<span class="text-sm text-gray-600 dark:text-gray-100">AM</span>
						</td>
						<td
							class="flex items-start gap-3 border px-6 py-3 text-lg dark:border-gray-700 dark:text-white"
						>
							{#each times as stopTime, index (index)}
								{#if stopTime.isShortLine}
									<span
										class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
										data-short-line="true"
									>
										<span>{extractMinutes(stopTime.arrivalTime)}</span>
										<span
											class="border-l border-amber-300 pl-1.5 text-xs font-medium dark:border-amber-700"
										>
											{$isLoading
												? ''
												: $t('schedule_for_stop.short_line_to', {
														values: { destination: stopTime.destination }
													})}
										</span>
									</span>
								{:else}
									<span class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-800">
										{extractMinutes(stopTime.arrivalTime)}
									</span>
								{/if}
							{/each}
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
		<tbody>
			<tr class="bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-900">
				<th
					colspan="2"
					scope="rowgroup"
					class="px-6 py-3 text-left font-semibold text-gray-700 dark:bg-gray-800 dark:text-white"
					>PM</th
				>
			</tr>
			{#if scheduleData.pmTimes.length === 0}
				<tr>
					<td colspan="2" class="border px-6 py-3 text-center text-gray-500">
						{$isLoading ? '' : $t('schedule_for_stop.no_pm_schedules_available')}
					</td>
				</tr>
			{:else}
				{#each scheduleData.pmTimes as [hour, times]}
					<tr class="hover:bg-gray-100 dark:hover:bg-gray-800">
						<td
							class="border px-6 py-3 text-center text-lg font-semibold dark:border-gray-700 dark:text-white"
							title="Full Time: {hour}:{extractMinutes(times[0].arrivalTime)}"
						>
							{convert24HourTo12Hour(hour)}
							<span class="text-sm text-gray-600 dark:text-gray-100">PM</span>
						</td>
						<td
							class="flex items-start gap-3 border px-6 py-3 text-lg dark:border-gray-700 dark:text-white"
						>
							{#each times as stopTime, index (index)}
								{#if stopTime.isShortLine}
									<span
										class="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
										data-short-line="true"
									>
										<span>{extractMinutes(stopTime.arrivalTime)}</span>
										<span
											class="border-l border-amber-300 pl-1.5 text-xs font-medium dark:border-amber-700"
										>
											{$isLoading
												? ''
												: $t('schedule_for_stop.short_line_to', {
														values: { destination: stopTime.destination }
													})}
										</span>
									</span>
								{:else}
									<span class="rounded bg-gray-50 px-2 py-1 dark:bg-gray-800">
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
</div>
