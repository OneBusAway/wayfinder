<script generics="Data, Item">
	// @ts-check
	import { setContext } from 'svelte';
	import { get, writable, derived } from 'svelte/store';

	/**
	 * @template T
	 * @typedef {import('svelte/store').Writable<T>} Writable
	 */

	// Create a store to track the active item and data.
	/** @type {Writable<Item | null>} */
	const activeItem = writable(null);
	/** @type {Writable<Data | null>} */
	const activeData = writable(null);

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 * @property {(event: { activeItem: Item | null, activeData: Data | null }) => void} handleAccordionSelectionChanged
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
		registerItem: (/** @type {Item} */ item) => {
			// An item can disappear while selected (for example, when a real-time
			// arrival is filtered out). Clear its selection so consumers do not
			// continue acting on data that no longer has a corresponding item.
			$effect(() => () => {
				if (get(activeItem) === item) {
					activeItem.set(null);
					activeData.set(null);
				}
			});

			const isActive = derived(activeItem, ($activeItem) => $activeItem === item);
			return {
				isActive,
				activate: (/** @type {Data} */ data) => {
					const newItem = $activeItem === item ? null : item;
					activeItem.set(newItem);
					activeData.set(newItem ? data : null);
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
