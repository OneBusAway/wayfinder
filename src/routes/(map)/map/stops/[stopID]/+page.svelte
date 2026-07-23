<!-- src/routes/(map)/map/stops/[stopID]/+page.svelte -->
<!--
    "/map/stops/{id}" — the map with this stop's sheet open. The map and sheet are
    rendered by the (map) layout (MapExperience) based on the URL; this page only
    emits the head tags a shared link needs, which SSR from the server load.
-->
<script>
	import { PUBLIC_OBA_REGION_NAME } from '$env/static/public';

	let { data } = $props();
	let stop = $derived(data.stopData);
</script>

<svelte:head>
	<title>{stop?.name ?? PUBLIC_OBA_REGION_NAME}</title>
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content={stop?.name ?? PUBLIC_OBA_REGION_NAME} />
</svelte:head>
