<!--
	@component
	Compact route badge used inside map popups: the route's color, its mode icon and
	its short name. Distinct from `RouteBadge.svelte`, which is the large glossy
	badge used in lists.

	@prop {string} shortName
	@prop {string} [color] - Route color as hex without "#" (from references.routes)
	@prop {string} [textColor] - Route text color as hex without "#"
	@prop {number} [routeType] - GTFS route type, picks the mode icon
-->
<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { contrastRatio } from '$lib/colorUtils';

	let { shortName, color = null, textColor = null, routeType = undefined } = $props();

	const background = $derived(color ? `#${color}` : '#374151');

	// WCAG contrast, not perceived brightness — see contrastRatio's docstring.
	const foreground = $derived.by(() => {
		if (textColor) return `#${textColor}`;
		return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#000000')
			? '#ffffff'
			: '#000000';
	});

	const modeIcon = $derived(prioritizedRouteTypeForDisplay(routeType));
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-bold"
	style="background-color: {background}; color: {foreground};"
>
	<FontAwesomeIcon icon={modeIcon} class="h-3 w-3" />
	{shortName}
</span>
