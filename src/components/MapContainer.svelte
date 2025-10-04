<script>
	import '$lib/i18n.js';
	import MapView from './map/MapView.svelte';
	import GoogleMapProvider from '$lib/Provider/GoogleMapProvider.svelte';
	import OpenStreetMapProvider from '$lib/Provider/OpenStreetMapProvider.svelte';
	import FullPageLoadingSpinner from '$components/FullPageLoadingSpinner.svelte';
	import { env } from '$env/dynamic/public';
	import { PUBLIC_OBA_MAP_PROVIDER } from '$env/static/public';
	import { onMount } from 'svelte';
	import { MapSource } from './../config/mapSource.js';

	let apiKey = env.PUBLIC_OBA_GOOGLE_MAPS_API_KEY;
	let { handleStopMarkerSelect, mapProvider = $bindable(), stop, ...restProps } = $props();

	onMount(() => {
		if (PUBLIC_OBA_MAP_PROVIDER === MapSource.Google) {
			mapProvider = new GoogleMapProvider(apiKey, handleStopMarkerSelect);
		} else if (PUBLIC_OBA_MAP_PROVIDER === MapSource.OpenStreetMap) {
			mapProvider = new OpenStreetMapProvider(handleStopMarkerSelect);
		} else {
			console.error('Unknown map provider:');
		}
	});
</script>

{#if mapProvider}
	<MapView {handleStopMarkerSelect} {mapProvider} {stop} {...restProps} />
{:else}
	<FullPageLoadingSpinner />
{/if}
