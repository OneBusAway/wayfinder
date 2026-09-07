import GoogleMapProvider from '$lib/Provider/GoogleMapProvider.svelte.js';
import OpenStreetMapProvider from '$lib/Provider/OpenStreetMapProvider.svelte.js';
import ArcGISMapProvider from '$lib/Provider/ArcGISMapProvider.svelte.js';
import { MapSource } from '$config/mapSource.js';

/** Creates the configured provider and keeps invalid deployment configuration usable. */
export function createMapProvider(source, config, handleStopMarkerSelect) {
	if (source === MapSource.Google) {
		return new GoogleMapProvider(config.googleApiKey, handleStopMarkerSelect);
	}
	if (source === MapSource.ArcGIS) {
		return new ArcGISMapProvider(
			config.arcgisApiKey,
			config.arcgisCustomBasemapUrl,
			handleStopMarkerSelect
		);
	}
	if (source !== MapSource.OpenStreetMap) {
		console.error(`Unknown map provider: ${source}; falling back to OSM.`);
	}
	return new OpenStreetMapProvider(handleStopMarkerSelect);
}
