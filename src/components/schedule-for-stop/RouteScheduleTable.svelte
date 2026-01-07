<script>
	import { t, isLoading } from 'svelte-i18n';

	let { schedule } = $props();

	function formatHour(hour) {
		const hourInt = +hour;
		if (hourInt === 0) return '12';
		if (hourInt > 12) return hourInt - 12;
		return hourInt;
	}

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

<div class="overflow-x-auto dark:bg-black">
	<table
		class="mt-4 w-full table-auto rounded-lg border border-gray-200 shadow-lg dark:border-gray-700 dark:bg-black"
	>
		<thead class="bg-gray-100 text-gray-800 dark:bg-gray-900">
			<tr>
				<th class="cursor-pointer px-6 py-3 text-left dark:text-white"
					>{$isLoading ? '' : $t('schedule_for_stop.hour')}</th
				>
				<th class="cursor-pointer px-6 py-3 text-left dark:text-white"
					>{$isLoading ? '' : $t('schedule_for_stop.minutes')}</th
				>
			</tr>
		</thead>
		<tbody>
			<tr class="bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-600">
				<td
					colspan="2"
					class="px-6 py-3 font-semibold text-gray-700 dark:bg-gray-800 dark:text-white">AM</td
				>
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
							title="Full Time: {hour}:{extractMinutes(times[0].arrivalTime)}"
						>
							{formatHour(hour)} <span class="text-sm text-gray-600 dark:text-gray-100">AM</span>
						</td>
						<td
							class="flex items-start gap-3 border px-6 py-3 text-lg dark:border-gray-700 dark:text-white"
						>
							{#each times as stopTime, index (index)}
								<span class="rounded bg-gray-50 px-2 dark:bg-gray-800">
									{extractMinutes(stopTime.arrivalTime)}
								</span>
							{/each}
						</td>
					</tr>
				{/each}
			{/if}

			<tr class="bg-gray-50 hover:bg-gray-100 dark:hover:bg-gray-900">
				<td
					colspan="2"
					class="px-6 py-3 font-semibold text-gray-700 dark:bg-gray-800 dark:text-white">PM</td
				>
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
							title="Full Time: {hour}:{extractMinutes(times[0].arrivalTime)}"
						>
							{formatHour(hour)} <span class="text-sm text-gray-600 dark:text-gray-100">PM</span>
						</td>
						<td
							class="flex items-start gap-3 border px-6 py-3 text-lg dark:border-gray-700 dark:text-white"
						>
							{#each times as stopTime, index (index)}
								<span class="rounded bg-gray-50 px-2 dark:bg-gray-800">
									{extractMinutes(stopTime.arrivalTime)}
								</span>
							{/each}
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
