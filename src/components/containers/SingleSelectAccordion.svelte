<script>
	import { setContext } from 'svelte';
	import { writable, derived } from 'svelte/store';

	// Create a store to track the active item and data.
	const activeItem = writable(null);
	const activeData = writable(null);

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children, handleAccordionSelectionChanged } = $props();

	// Watch for changes to activeItem and dispatch event
	$effect(() => {
		handleAccordionSelectionChanged({
			activeItem: $activeItem,
			activeData: $activeData
		});
	});

	// Provide context for child AccordionItems
	setContext('accordion', {
		registerItem: (id) => {
			const isActive = derived(activeItem, ($activeItem) => $activeItem === id);
			return {
				isActive,
				activate: (data) => {
					const newId = $activeItem === id ? null : id;
					activeItem.set(newId);
					activeData.set(newId ? data : null);
				}
			};
		}
	});
</script>

<!-- border-b only (not border-y): the first item sits directly under a header
     that already draws its own bottom rule, and a top border here would double
     it up. Combined with divide-y, every item ends with exactly one rule. -->
<div
	class="divide-y divide-gray-200 border-b border-gray-200 dark:divide-gray-700 dark:border-gray-700"
>
	{@render children?.()}
</div>
