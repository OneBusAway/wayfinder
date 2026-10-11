<script>
	// @ts-check
	import SingleSelectAccordion from '../SingleSelectAccordion.svelte';
	import AccordionItem from '../AccordionItem.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {boolean} showItem
	 * @property {boolean} [showSecondItem]
	 * @property {(event: import('$lib/types').AccordionSelection) => void} handleAccordionSelectionChanged
	 */
	/** @type {Props} */
	let { showItem, showSecondItem = false, handleAccordionSelectionChanged } = $props();
</script>

<SingleSelectAccordion {handleAccordionSelectionChanged}>
	{#if showItem}
		<AccordionItem data={{ tripId: 'active-trip' }}>
			{#snippet header(active)}
				<span data-testid="active-header" class:active>Active trip</span>
			{/snippet}
			<p>Trip details</p>
		</AccordionItem>
	{/if}
	{#if showSecondItem}
		<AccordionItem>
			{#snippet header(active)}
				<span data-testid="second-header" class:active>Other item</span>
			{/snippet}
			<p>Other details</p>
		</AccordionItem>
	{/if}
</SingleSelectAccordion>
