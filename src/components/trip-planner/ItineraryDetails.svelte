<script>
	import LegDetails from './LegDetails.svelte';
	import { formatTime } from '$lib/formatters';
	export let itinerary;
	export let expandedSteps;
	export let toggleSteps;
</script>

<div class="mb-4 flex items-center justify-between rounded-lg bg-gray-100 p-4 shadow-md">
	<div class="text-center">
		<p class="text-sm font-semibold text-gray-500">Duration</p>
		<p class="text-lg font-bold text-gray-700">{Math.round(itinerary.duration / 60)} min</p>
	</div>
	<div class="text-center">
		<p class="text-sm font-semibold text-gray-500">Start Time</p>
		<p class="text-lg font-bold text-gray-700">{formatTime(itinerary.startTime)}</p>
	</div>
	<div class="text-center">
		<p class="text-sm font-semibold text-gray-500">End Time</p>
		<p class="text-lg font-bold text-gray-700">{formatTime(itinerary.endTime)}</p>
	</div>
</div>
<div class="space-y-4">
	{#each itinerary.legs as leg, index}
		<LegDetails {leg} {index} {expandedSteps} {toggleSteps} />
	{/each}
</div>
