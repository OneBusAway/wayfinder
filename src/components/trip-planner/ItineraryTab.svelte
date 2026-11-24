<!-- eslint-disable svelte/block-lang -->
<script>
	// @ts-check
	import { t } from 'svelte-i18n';
	import AppIcon from '$components/icons/AppIcon.svelte';
	import { getLegModeIcon } from './legModeIcon';

	/**
	 * @typedef {Object} Props
	 * @property {number} index
	 * @property {number} activeTab
	 * @property {(index: number) => void} setActiveTab
	 * @property {import('$lib/types').Itinerary} itinerary
	 */
	/** @type {Props} */
	let { index, activeTab, setActiveTab, itinerary } = $props();

	// Get unique transport modes from itinerary legs
	/** @param {import('$lib/types').ItineraryLeg[]|undefined} legs */
	function getTransportModes(legs) {
		if (!legs) return [];
		const modes = [];
		// local to this function
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seenModes = new Set();

		for (const leg of legs) {
			if (!seenModes.has(leg.mode)) {
				seenModes.add(leg.mode);
				modes.push(leg.mode);
			}
		}
		return modes;
	}

	// Modes without an icon are left out here, not in the template, so the
	// arrows only ever sit between two icons.
	let modeIcons = $derived(
		getTransportModes(itinerary?.legs)
			.map(getLegModeIcon)
			.filter((icon) => icon !== null)
	);
	let durationMinutes = $derived(itinerary ? Math.round(itinerary.duration / 60) : 0);
</script>

<button
	class="itinerary-tab"
	class:itinerary-tab--active={activeTab === index}
	onclick={() => setActiveTab(index)}
>
	<span class="font-semibold">{durationMinutes} {$t('time.min')}</span>
	{#if modeIcons.length > 0}
		<span class="flex items-center gap-1 text-xs opacity-80">
			<!-- FIXME: each block has no key -->
			<!-- eslint-disable-next-line svelte/require-each-key -->
			{#each modeIcons as icon, i}
				{#if i > 0}
					<span class="text-[10px]">&rarr;</span>
				{/if}
				<AppIcon {icon} class="h-3 w-3" />
			{/each}
		</span>
	{/if}
</button>
