<script>
	import LegDetails from './LegDetails.svelte';
	import { formatTime } from '$lib/formatters';
	export let itinerary;
	export let expandedSteps;
	export let toggleSteps;
</script>

<div class="border-b border-gray-300 p-4">
	<p>Duration: {Math.round(itinerary.duration / 60)} minutes</p>
	<p>Start Time: {formatTime(itinerary.startTime)}</p>
	<p>End Time: {formatTime(itinerary.endTime)}</p>

	<div class="mt-4 space-y-4">
		{#each itinerary.legs as leg, index}
			<LegDetails {leg} {index} {expandedSteps} {toggleSteps} />
		{/each}
	</div>
</div>
