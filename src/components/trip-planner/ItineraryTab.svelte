<script>
	import { t } from 'svelte-i18n';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faWalking,
		faBus,
		faTrain,
		faFerry,
		faTrainSubway,
	} from '@fortawesome/free-solid-svg-icons';

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
				return faWalking;
			case 'BUS':
				return faBus;
			case 'TRAIN':
			case 'RAIL':
				return faTrain;
			case 'FERRY':
				return faFerry;
			case 'LIGHT_RAIL':
				return faTrainSubway;
			case 'TRAM':
				return faTrainSubway;
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
				{@const icon = getModeIcon(mode)}
				{#if icon}
					{#if i > 0}
						<span class="text-[10px]">&rarr;</span>
					{/if}
					<FontAwesomeIcon {icon} class="h-3 w-3" />
				{/if}
			{/each}
		</span>
	{/if}
</button>
