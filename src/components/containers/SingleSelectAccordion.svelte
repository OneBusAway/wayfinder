<script>
	// @ts-check
	import { setContext } from 'svelte';
	import { get, writable, derived, readable } from 'svelte/store';

	// Create a store to track the active item and data.
	/** @type {import('svelte/store').Writable<string | null>} */
	const activeItem = writable(null);
	/** @type {import('svelte/store').Writable<unknown>} */
	const activeData = writable(null);
	const skipAnimation = readable(false);

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 * @property {(event: import('$lib/types').AccordionSelection) => void} handleAccordionSelectionChanged
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
	/** @type {import('$lib/types').AccordionContext} */
	const context = {
		registerItem: (id) => {
			// An item can disappear while selected (for example, when a real-time
			// arrival is filtered out). Clear its selection so consumers do not
			// continue acting on data that no longer has a corresponding item.
			$effect(() => () => {
				if (get(activeItem) === id) {
					activeItem.set(null);
					activeData.set(null);
				}
			});

			const isActive = derived(activeItem, ($activeItem) => $activeItem === id);
			return {
				isActive,
				skipAnimation,
				activate: (data) => {
					const newId = $activeItem === id ? null : id;
					activeItem.set(newId);
					activeData.set(newId ? data : null);
				}
			};
		}
	};
	setContext('accordion', context);
</script>

<!-- border-b only (not border-y): the first item sits directly under a header
     that already draws its own bottom rule, and a top border here would double
     it up. Combined with divide-y, every item ends with exactly one rule. -->
<div
	class="divide-y divide-gray-200 border-b border-gray-200 dark:divide-gray-700 dark:border-gray-700"
>
	{@render children?.()}
</div>
