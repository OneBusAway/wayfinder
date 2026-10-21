<script>
	import '$lib/i18n.js';
	import MapView from './map/MapView.svelte';
	import { createMapProvider } from '$lib/mapProviderFactory.js';
	import FullPageLoadingSpinner from '$components/FullPageLoadingSpinner.svelte';
	import { env } from '$env/dynamic/public';
	import { PUBLIC_OBA_MAP_PROVIDER } from '$env/static/public';
	import { onMount } from 'svelte';

	let apiKey = env.PUBLIC_OBA_GOOGLE_MAPS_API_KEY;
	let arcgisApiKey = env.PUBLIC_ARCGIS_API_KEY;
	let arcgisCustomBasemapUrl = env.PUBLIC_ARCGIS_CUSTOM_BASEMAP_URL;
	let {
		handleStopMarkerSelect,
		mapProvider = $bindable(),
		stop,
		initialCoords = null,
		startInTripPlanMode = false,
		...restProps
	} = $props();

	onMount(() => {
		mapProvider = createMapProvider(
			PUBLIC_OBA_MAP_PROVIDER,
			{ googleApiKey: apiKey, arcgisApiKey, arcgisCustomBasemapUrl },
			handleStopMarkerSelect
		);
	});
</script>

{#if mapProvider}
	<MapView
		{handleStopMarkerSelect}
		{mapProvider}
		{stop}
		{initialCoords}
		{startInTripPlanMode}
		{...restProps}
	/>
{:else}
	<FullPageLoadingSpinner />
{/if}
