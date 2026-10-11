<script>
	// @ts-check
	import Accordion from '../Accordion.svelte';
	import AccordionItem from '../AccordionItem.svelte';

	/** @type {{ animate?: boolean }} */
	let { animate = true } = $props();
	let items = $state(/** @type {string[]} */ ([]));
	let accordion = $state(/** @type {ReturnType<typeof Accordion> | undefined} */ (undefined));
</script>

<button onclick={() => accordion?.openAll(animate)}>Expand all</button>
<button onclick={() => accordion?.closeAll(animate)}>Collapse all</button>
<p data-testid="registered-items">{items.length}</p>
<Accordion bind:this={accordion} bind:items>
	{#each ['First route', 'Second route'] as name}
		<AccordionItem>
			{#snippet header(active)}
				<span class:active>{name}</span>
			{/snippet}
			<p>{name} schedule</p>
		</AccordionItem>
	{/each}
</Accordion>
