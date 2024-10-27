<script>
	import '$lib/i18n.js';
	import MapView from './map/MapView.svelte';
	import GoogleMapProvider from '$lib/Provider/GoogleMapProvider';
	import OpenStreetMapProvider from '$lib/Provider/OpenStreetMapProvider';
	import {
		PUBLIC_OBA_MAP_PROVIDER,
		PUBLIC_OBA_GOOGLE_MAPS_API_KEY as apiKey
	} from '$env/static/public';
	import { createEventDispatcher, onMount } from 'svelte';
	import { MapSource } from './../config/mapSource.js';

	export let mapProvider = null;
	export let mapSource = null;
	const dispatch = createEventDispatcher();

	onMount(() => {
		if (PUBLIC_OBA_MAP_PROVIDER === MapSource.Google) {
			mapProvider = new GoogleMapProvider(apiKey);
			mapSource = MapSource.Google;
		} else if (PUBLIC_OBA_MAP_PROVIDER === MapSource.OpenStreetMap) {
			mapProvider = new OpenStreetMapProvider(apiKey);
			mapSource = MapSource.OpenStreetMap;
		} else {
			console.error('Unknown map provider:');
		}
	});

	function forward(event) {
		dispatch(event.type, event.detail);
	}
</script>

{#if mapProvider}
	<MapView
		{mapProvider}
		{...$$props}
		on:stopSelected={forward}
		on:selectedTrip={forward}
		on:selectedRoute={forward}
		on:showRoute={forward}
		on:showRouteMap={forward}
		on:stop={forward}
		on:mapProvider={forward}
	/>
{:else}
	<p>Loading map...</p>
{/if}
