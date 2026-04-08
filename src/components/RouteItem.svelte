<script>
	import { removeAgencyPrefix } from '$lib/utils';
	import { adjustColorForDarkMode } from '$lib/colorUtils';
	import FavoriteButton from '$components/favorites/FavoriteButton.svelte';

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

	const lightModeColor = route.color ? `#${route.color}` : '#000000';
	const darkModeColor = route.color ? adjustColorForDarkMode(`#${route.color}`) : '#ffffff';
</script>

<div class="route-item flex w-full items-center justify-between border-b border-gray-200 bg-[#f9f9f9] hover:bg-[#e9e9e9] dark:border-[#313135] dark:bg-[#1c1c1c] dark:hover:bg-[#363636]">
	<button
		type="button"
		class="flex-1 p-4 text-left focus:outline-none"
		onclick={() => handleModalRouteClick(route)}
	>
		<div
			class="text-lg font-semibold text-[var(--route-color-light)] dark:text-[var(--route-color-dark)]"
			style="--route-color-light: {lightModeColor}; --route-color-dark: {darkModeColor}"
		>
			{getDisplayRouteName(route)}
		</div>
	</button>
	<div class="pr-4">
		<FavoriteButton id={route.id} type="route" ariaLabel={`Add ${getDisplayRouteName(route)} to favorites`} />
	</div>
</div>
