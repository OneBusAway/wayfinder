<script>
	import StopItem from '$components/StopItem.svelte';
	import ModalPane from '$components/navigation/ModalPane.svelte';
	import {t} from 'svelte-i18n';

	let {selectedRoute, stops, mapProvider, closePane} = $props();

	function handleStopItemClick(stop) {
		mapProvider.flyTo(stop.lat, stop.lon, 18);
		mapProvider.openStopMarker(stop);
	}

	function title() {
		if (!selectedRoute) {
			return '';
		}

		return $t('route_modal_title', {values: {name: selectedRoute.shortName}});
	}
</script>

<ModalPane {closePane} title={title()}>
	{#if stops && selectedRoute}
		<div className="space-y-4">
			<div>
				<div className="h-36 rounded-lg bg-brand-secondary bg-opacity-80 p-4">
					<h1 className="mb-6 text-center text-2xl font-bold text-white">
						Route: {selectedRoute.shortName}
					</h1>
					<h2 className="mb-6 text-center text-xl text-white">{selectedRoute.description}</h2>
				</div>
			</div>

			<div className="space-y-2 rounded-lg">
				<div>
					{#each stops as stop}
						<StopItem {stop} {handleStopItemClick}/>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</ModalPane>
