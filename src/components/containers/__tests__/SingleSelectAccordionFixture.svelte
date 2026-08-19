<script>
	import SingleSelectAccordion from '../SingleSelectAccordion.svelte';
	import AccordionItem from '../AccordionItem.svelte';

	let { showItem, handleAccordionSelectionChanged } = $props();
</script>

<SingleSelectAccordion {handleAccordionSelectionChanged}>
	{#if showItem}
		<AccordionItem data={{ tripId: 'active-trip' }}>
			{#snippet header()}
				Active trip
			{/snippet}
		</AccordionItem>
	{/if}
</SingleSelectAccordion>
