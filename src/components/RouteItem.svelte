<script>
	import { createEventDispatcher } from 'svelte';
	export let route;
	const dispatch = createEventDispatcher();

	function handleClick() {
		dispatch('routeClick', { route });
	}

	function getDisplayRouteName() {
		if (route.shortName && route.longName) {
			return `${route.shortName} - ${route.longName}`;
		} else if (route.shortName && route.description) {
			return `${route.shortName} - ${route.description}`;
		} else if (!route.shortName && (route.longName || route.description)) {
			return `${route.agencyInfo.name} - ${route.longName || route.description}`;
		}
	}
</script>

<button
	type="button"
	class="route-item flex w-full items-center justify-between border-b border-gray-200 bg-[#f9f9f9] p-4 text-left hover:bg-[#e9e9e9] focus:outline-none dark:border-[#313135] dark:bg-[#1c1c1c] dark:text-white dark:hover:bg-[#363636]"
	on:click={handleClick}
>
	<div class="text-lg font-semibold" style="color: #{route.color}">
		{getDisplayRouteName(route)}
	</div>
</button>
