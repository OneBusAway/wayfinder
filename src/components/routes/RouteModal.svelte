<script>
	import StopItem from '$components/StopItem.svelte';
	import ModalPane from '$components/navigation/ModalPane.svelte';
	import { t } from 'svelte-i18n';

	let { selectedRoute, stops, mapProvider, closePane } = $props();

	let showFullDescription = $state(false);

	// Check if description is long enough to need truncation (roughly 3 lines)
	const isDescriptionLong = $derived(
		selectedRoute?.description ? selectedRoute.description.length > 120 : false
	);

	// Reset expanded state when route changes
	$effect(() => {
		if (selectedRoute) {
			showFullDescription = false;
		}
	});

	function handleStopItemClick(stop) {
		mapProvider.flyTo(stop.lat, stop.lon, 18);
		mapProvider.openStopMarker(stop);
	}

	function title() {
		if (!selectedRoute) {
			return '';
		}

		return $t('route_modal_title', { values: { name: selectedRoute.shortName } });
	}

	function toggleDescription() {
		showFullDescription = !showFullDescription;
	}
</script>

<ModalPane {closePane} title={title()}>
	{#if stops && selectedRoute}
		<div class="space-y-4">
			<div>
				<div class="min-h-36 rounded-lg bg-brand-accent bg-opacity-80 p-4">
					<h1 class="mb-4 text-center text-2xl font-bold text-white">
						Route: {selectedRoute.shortName}
					</h1>
					<div class="relative">
						<h2
							class="text-center text-xl text-white transition-all duration-200 {showFullDescription
								? ''
								: 'line-clamp-3 max-h-24 overflow-hidden'}"
						>
							{selectedRoute.description}
						</h2>
						{#if isDescriptionLong || showFullDescription}
							<button
								type="button"
								onclick={toggleDescription}
								aria-expanded={showFullDescription}
								class="mt-2 w-full rounded text-center text-sm font-semibold text-white underline hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-accent"
							>
								{showFullDescription ? $t('show_less') : $t('show_more')}
							</button>
						{/if}
					</div>
				</div>
			</div>

			<div class="space-y-2 rounded-lg">
				<div>
					{#each stops as stop}
						<StopItem {stop} {handleStopItemClick} />
					{/each}
				</div>
			</div>
		</div>
	{/if}
</ModalPane>
