<script>
	import '$lib/i18n.js';
	import MapView from './map/MapView.svelte';
	import GoogleMapProvider from '$lib/Provider/GoogleMapProvider.svelte';
	import OpenStreetMapProvider from '$lib/Provider/OpenStreetMapProvider.svelte';
	import ArcGISMapProvider from '$lib/Provider/ArcGISMapProvider.svelte';
	import FullPageLoadingSpinner from '$components/FullPageLoadingSpinner.svelte';
	import { env } from '$env/dynamic/public';
	import { PUBLIC_OBA_MAP_PROVIDER } from '$env/static/public';
	import { onMount } from 'svelte';
	import { MapSource } from './../config/mapSource.js';

	let apiKey = env.PUBLIC_OBA_GOOGLE_MAPS_API_KEY;
	let arcgisApiKey = env.PUBLIC_ARCGIS_API_KEY;
	let arcgisCustomBasemap = env.PUBLIC_ARCGIS_CUSTOM_BASEMAP_URL;
	let {
		handleStopMarkerSelect,
		mapProvider = $bindable(),
		stop,
		initialCoords = null,
		...restProps
	} = $props();

	onMount(() => {
		if (PUBLIC_OBA_MAP_PROVIDER === MapSource.Google) {
			mapProvider = new GoogleMapProvider(apiKey, handleStopMarkerSelect);
		} else if (PUBLIC_OBA_MAP_PROVIDER === MapSource.OpenStreetMap) {
			mapProvider = new OpenStreetMapProvider(handleStopMarkerSelect);
		} else if (PUBLIC_OBA_MAP_PROVIDER === MapSource.ArcGIS) {
			mapProvider = new ArcGISMapProvider(arcgisApiKey, handleStopMarkerSelect, arcgisCustomBasemap);
		} else {
			console.error('Unknown map provider:', PUBLIC_OBA_MAP_PROVIDER);
		}
	});
</script>

{#if mapProvider}
	<MapView {handleStopMarkerSelect} {mapProvider} {stop} {initialCoords} {...restProps} />
{:else}
	<FullPageLoadingSpinner />
{/if}
