<script>
	import LegDetails from './LegDetails.svelte';
	import { formatTime } from '$lib/formatters';
	import { t } from 'svelte-i18n';
	let { itinerary, expandedSteps, toggleSteps } = $props();
</script>

<!-- Summary Card -->
<div
	class="mb-6 flex items-stretch justify-between divide-x divide-gray-200 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4 shadow-sm dark:divide-gray-700 dark:border-gray-700 dark:from-gray-800/80 dark:to-gray-800/40"
>
	<div class="flex-1 px-3 text-center first:pl-0 last:pr-0">
		<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
			{$t('trip-planner.duration')}
		</p>
		<p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
			{Math.round(itinerary.duration / 60)}
			<span class="text-base font-medium text-gray-600 dark:text-gray-300">{$t('time.min')}</span>
		</p>
	</div>
	<div class="flex-1 px-3 text-center first:pl-0 last:pr-0">
		<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
			{$t('trip-planner.start_time')}
		</p>
		<p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
			{formatTime(itinerary.startTime)}
		</p>
	</div>
	<div class="flex-1 px-3 text-center first:pl-0 last:pr-0">
		<p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
			{$t('trip-planner.end_time')}
		</p>
		<p class="mt-1 text-xl font-bold text-gray-900 dark:text-white">
			{formatTime(itinerary.endTime)}
		</p>
	</div>
</div>

<!-- Legs Timeline -->
<div class="space-y-0">
	{#each itinerary.legs as leg, index}
		<LegDetails
			{leg}
			{index}
			{expandedSteps}
			{toggleSteps}
			isLast={index === itinerary.legs.length - 1}
		/>
	{/each}
</div>
