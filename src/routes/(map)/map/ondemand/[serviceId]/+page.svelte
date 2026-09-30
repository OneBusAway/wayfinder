<!--
    "/map/ondemand/{id}" — the map with this on-demand service's sheet open. The
    map and sheet are rendered by the (map) layout (MapExperience); this page
    seeds the client cache from the server load and emits head tags.
-->
<script>
	import { browser } from '$app/environment';
	import { PUBLIC_OBA_REGION_NAME } from '$env/static/public';
	import { seedService } from '$lib/onDemand/onDemandState.svelte.js';

	let { data } = $props();

	// Browser only: the cache is module state, which on the server would be shared
	// across every request.
	$effect.pre(() => {
		if (browser && data.onDemandEntry) {
			seedService(data.onDemandServiceId, 'simplified', data.onDemandEntry);
		}
	});

	let title = $derived(data.onDemandEntry?.data?.entry?.name ?? PUBLIC_OBA_REGION_NAME);
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>
