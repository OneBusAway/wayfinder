<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
	import TripDetailsPane from '../oba/TripDetailsPane.svelte';

	export let stop;
	export let selectedTripDetails;
	export let onClose;
</script>

<div class="trip-details-modal">
	<div class="py-1 text-left">
		<button type="button" on:click={onClose} class="close-button">
			<FontAwesomeIcon icon={faArrowLeft} class="font-black text-black dark:text-white" />
			<div class="font-semibold text-black dark:text-white">Back to {stop.name}</div>
		</button>
	</div>
	<div
		class="flex items-center justify-between rounded-lg bg-[#ffffff] p-4 hover:bg-[#e3e3e3] dark:bg-[#1c1c1c] hover:dark:bg-[#363636]"
	>
		<div>
			<h2 class="text-lg font-semibold text-black dark:text-white">
				{selectedTripDetails.routeShortName} - {selectedTripDetails.tripHeadsign}
			</h2>
			<p class="text-sm font-semibold text-gray-600 dark:text-gray-400">
				{new Date(selectedTripDetails.scheduledArrivalTime).toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit'
				})} -
				<span class={selectedTripDetails.arrivalStatus.color}>
					{selectedTripDetails.arrivalStatus.text}
				</span>
			</p>
		</div>
		<p class={`mt-1 text-sm font-semibold ${selectedTripDetails.arrivalStatus.color}`}>
			{selectedTripDetails.timeToReach}
		</p>
	</div>
	<div class="px-4 py-2">
		<TripDetailsPane
			{stop}
			tripId={selectedTripDetails.tripId}
			serviceDate={selectedTripDetails.serviceDate}
		/>
	</div>
</div>

<style lang="postcss">
	.trip-details-modal {
		@apply absolute bottom-0 left-0 z-40 h-full w-full overflow-y-scroll rounded-lg bg-white px-2 shadow-lg md:max-w-prose;
		@apply rounded-lg border-b-[1px] border-[#C6C6C8] bg-white p-4 shadow-lg dark:border-[1px] dark:border-[#C6C6C8] dark:border-opacity-15 dark:bg-black;
	}
	.close-button {
		@apply flex items-center gap-2 rounded px-4 py-2;
		@apply transition duration-300 ease-in-out hover:bg-neutral-200 dark:hover:bg-neutral-200/50;
	}
</style>
