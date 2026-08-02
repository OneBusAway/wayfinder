<!--
    @component
    Owns the map experience. Because `/` and `/map/stops/[stopID]` share this
    `(map)` group layout, the map stays mounted across navigations between them —
    only the child +page.svelte components are recreated.
-->
<script>
	import MapExperience from '$components/MapExperience.svelte';

	let { children } = $props();
</script>

<MapExperience />
{@render children()}
