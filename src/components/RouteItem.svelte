<script>
	import { removeAgencyPrefix } from '$lib/utils';

	let { handleModalRouteClick, route } = $props();

	function getDisplayRouteName() {
		const cleanShortName = route.shortName ? removeAgencyPrefix(route.shortName) : null;

		if (cleanShortName && route.longName) {
			return `${cleanShortName} - ${route.longName}`;
		} else if (cleanShortName && route.description) {
			return `${cleanShortName} - ${route.description}`;
		} else if (!cleanShortName && (route.longName || route.description)) {
			return `${route.agencyInfo.name} - ${route.longName || route.description}`;
		}
	}
</script>

<button
	type="button"
	class="route-item flex w-full items-center justify-between border-b border-gray-200 bg-[#f9f9f9] p-4 text-left hover:bg-[#e9e9e9] focus:outline-none dark:border-[#313135] dark:bg-[#1c1c1c] dark:text-white dark:hover:bg-[#363636]"
	onclick={() => handleModalRouteClick(route)}
>
	<div class="text-lg font-semibold" style="color: #{route.color}">
		{getDisplayRouteName(route)}
	</div>
</button>
