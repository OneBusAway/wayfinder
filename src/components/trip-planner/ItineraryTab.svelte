<script>
	import { t } from 'svelte-i18n';
	import { BusFront, Footprints, Ship, TrainFrontTunnel, TramFront } from '@lucide/svelte';

	let { index, activeTab, setActiveTab, itinerary } = $props();

	// Get unique transport modes from itinerary legs
	function getTransportModes(legs) {
		if (!legs) return [];
		const modes = [];
		const seenModes = new Set();

		for (const leg of legs) {
			if (!seenModes.has(leg.mode)) {
				seenModes.add(leg.mode);
				modes.push(leg.mode);
			}
		}
		return modes;
	}

	function getModeIcon(mode) {
		switch (mode) {
			case 'WALK':
				return Footprints;
			case 'BUS':
				return BusFront;
			case 'TRAIN':
			case 'RAIL':
				return TramFront;
			case 'FERRY':
				return Ship;
			case 'LIGHT_RAIL':
				return TrainFrontTunnel;
			case 'TRAM':
				return TramFront;
			default:
				return null;
		}
	}

	let transportModes = $derived(getTransportModes(itinerary?.legs));
	let durationMinutes = $derived(itinerary ? Math.round(itinerary.duration / 60) : 0);
</script>

<button
	class="itinerary-tab"
	class:itinerary-tab--active={activeTab === index}
	onclick={() => setActiveTab(index)}
>
	<span class="font-semibold">{durationMinutes} {$t('time.min')}</span>
	{#if transportModes.length > 0}
		<span class="flex items-center gap-1 text-xs opacity-80">
			{#each transportModes as mode, i}
				{@const Icon = getModeIcon(mode)}
				{#if Icon}
					{#if i > 0}
						<span class="text-[10px]">&rarr;</span>
					{/if}
					<Icon class="h-3 w-3" />
				{/if}
			{/each}
		</span>
	{/if}
</button>
