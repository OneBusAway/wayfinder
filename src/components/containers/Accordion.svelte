<script>
	import { setContext } from 'svelte';
	import { writable, derived } from 'svelte/store';

	// Store for animation state
	const skipAnimation = writable(false);

	// Create a store to track multiple active items using a Set
	const activeItems = writable(new Set());

	/**
	 * @typedef {Object} Props
	 * @property {string[]} [items] - Props to track all possible item IDs
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { items = $bindable([]), children } = $props();
	// Methods to open/close all items
	export const openAll = (animate = true) => {
		skipAnimation.set(!animate);
		activeItems.set(new Set(items));
		// Reset skip animation after a short delay
		setTimeout(() => skipAnimation.set(false), 0);
	};

	export const closeAll = (animate = true) => {
		skipAnimation.set(!animate);
		activeItems.set(new Set());
		// Reset skip animation after a short delay
		setTimeout(() => skipAnimation.set(false), 0);
	};

	// Provide context for child AccordionItems and expose methods
	setContext('accordion', {
		registerItem: (id) => {
			// Add the item ID to our items array if not already present
			if (!items.includes(id)) {
				items = [...items, id];
			}

			const isActive = derived(activeItems, ($activeItems) => $activeItems.has(id));
			return {
				isActive,
				skipAnimation,
				activate: () => {
					activeItems.update((items) => {
						const newItems = new Set(items);
						if (newItems.has(id)) {
							newItems.delete(id);
						} else {
							newItems.add(id);
						}
						return newItems;
					});
				}
			};
		},
		openAll,
		closeAll
	});
</script>

<div
	class="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700 dark:border-gray-700"
>
	{@render children?.()}
</div>
