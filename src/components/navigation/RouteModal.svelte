<script>
	import ModalHeader from '$components/modals/ModalHeader.svelte';
	import StopItem from '$components/StopItem.svelte';

	export let selectedRoute;
	export let stops;
	export let mapProvider;

	function handleStopItemClick(event) {
		const { stop } = event.detail;

		mapProvider.panTo(stop.lat, stop.lon);
		mapProvider.setZoom(20);
	}
</script>

{#if stops && selectedRoute}
	<div class="space-y-4">
		<div>
			<ModalHeader title="Route {selectedRoute.shortName}" subtitle={selectedRoute.description} />
		</div>

		<div class="scrollbar-hidden h-96 space-y-2 overflow-y-scroll rounded-lg">
			<div>
				{#each stops as stop}
					<StopItem {stop} on:stopClick={handleStopItemClick} />
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.scrollbar-hidden {
		scrollbar-width: none;
		-ms-overflow-style: none;
		overflow: -moz-scrollbars-none;
		-webkit-scrollbar: none;
	}
</style>
