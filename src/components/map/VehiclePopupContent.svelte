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

<div class="max-w-xs rounded-lg bg-white p-4 shadow-md">
	<div class="text-lg font-bold text-gray-800">{nextDestination}</div>
	<div class="text-gray-600">
		{#if predicted}
			Vehicle #<span class="font-semibold text-blue-500">{vehicleId || 'N/A'}</span> | Data updated
			<span class="font-semibold text-blue-500">{formatLastUpdated(lastUpdateTime)}</span>
		{:else}
			<span class="font-semibold text-gray-500"
				>we don't have a real-time data for this vehicle now.</span
			>
		{/if}
	</div>
	<br />
	<div class="font-bold text-gray-800">Next stop:</div>
	<div class="text-gray-600">
		<strong class="font-semibold text-blue-500">{nextStopName || 'N/A'}</strong>
	</div>
	<br />
</div>
