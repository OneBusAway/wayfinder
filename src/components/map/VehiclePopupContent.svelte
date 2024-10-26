<script>
	export let nextDestination;
	export let vehicleId;
	export let lastUpdateTime;
	export let nextStopName;
	export let predicted;

	function formatLastUpdated(timestamp) {
		const date = new Date(timestamp);
		const now = new Date();
		const secondsAgo = Math.floor((now - date) / 1000);

		const minutes = Math.floor(secondsAgo / 60);
		const seconds = secondsAgo % 60;

		if (minutes > 0) {
			return `${minutes} min${minutes > 1 ? 's' : ''} ${seconds} sec${seconds > 1 ? 's' : ''} ago`;
		}
		return `${seconds} sec${seconds > 1 ? 's' : ''} ago`;
	}
</script>

// TODO: Add vehicle icon, add the nextStops times

<div class="max-w-xs rounded-lg bg-white p-4 text-gray-800 shadow-md">
	<div class="mb-2 flex items-center">
		<div class="rounded bg-green-100 px-2 py-1 text-lg font-bold text-green-600">
			{nextDestination}
		</div>
	</div>
	<div class="text-sm text-gray-600">
		{#if predicted}
			Vehicle #<span class="font-semibold text-blue-500">{vehicleId || 'N/A'}</span> | Data updated
			<span class="font-semibold text-blue-500">{formatLastUpdated(lastUpdateTime)}</span>
		{:else}
			<span class="font-semibold text-gray-500"
				>We don't have real-time data for this vehicle now.</span
			>
		{/if}
	</div>
	<hr class="my-2" />
	<div class="text-sm font-bold text-gray-800">Next stop:</div>
	<div class="text-sm text-gray-600">
		<strong class="font-semibold text-blue-500">{nextStopName || 'N/A'}</strong>
	</div>
	<hr class="my-2" />
</div>
