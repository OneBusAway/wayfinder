<script>
	import '$lib/i18n.js';
	import MapView from './map/MapView.svelte';
	import GoogleMapProvider from '$lib/Provider/GoogleMapProvider.svelte';
	import OpenStreetMapProvider from '$lib/Provider/OpenStreetMapProvider.svelte';
	import FullPageLoadingSpinner from '$components/FullPageLoadingSpinner.svelte';
	import { env } from '$env/dynamic/public';
	import { PUBLIC_OBA_MAP_PROVIDER } from '$env/static/public';
	import { MapSource } from './../config/mapSource.js';
	
	
	let { handleStopMarkerSelect, mapProvider = $bindable(), ...restProps } = $props();
	
	// memoize provider creation to avoid unnecessary instantiations 🙅
	$effect(() => {
		const apiKey = env.PUBLIC_OBA_GOOGLE_MAPS_API_KEY;
		
		if (PUBLIC_OBA_MAP_PROVIDER === MapSource.Google) {
			mapProvider = new GoogleMapProvider(apiKey, handleStopMarkerSelect);
		} else if (PUBLIC_OBA_MAP_PROVIDER === MapSource.OpenStreetMap) {
			mapProvider = new OpenStreetMapProvider(handleStopMarkerSelect);
		} else {
			console.error('Unknown map provider:', PUBLIC_OBA_MAP_PROVIDER);
		}
	});
</script>

{#if mapProvider}
	<MapView {handleStopMarkerSelect} {mapProvider} {...restProps} />
{:else}
	<FullPageLoadingSpinner />
{/if}