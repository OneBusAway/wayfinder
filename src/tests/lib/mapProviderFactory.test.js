import { beforeEach, describe, expect, test, vi } from 'vitest';

const providers = vi.hoisted(() => ({ google: vi.fn(), osm: vi.fn(), arcgis: vi.fn() }));

vi.mock('$lib/Provider/GoogleMapProvider.svelte', () => ({ default: providers.google }));
vi.mock('$lib/Provider/OpenStreetMapProvider.svelte', () => ({ default: providers.osm }));
vi.mock('$lib/Provider/ArcGISMapProvider.svelte', () => ({ default: providers.arcgis }));

import { createMapProvider } from '$lib/mapProviderFactory.js';

describe('createMapProvider', () => {
	const handler = vi.fn();
	const config = {
		googleApiKey: 'google-key',
		arcgisApiKey: 'arcgis-key',
		arcgisCustomBasemapUrl: 'https://tiles.example.test/style.json'
	};

	beforeEach(() => {
		providers.google.mockReset();
		providers.osm.mockReset();
		providers.arcgis.mockReset();
		console.error.mockClear();
	});

	test('selects ArcGIS and passes dynamic public configuration', () => {
		createMapProvider('arcgis', config, handler);
		expect(providers.arcgis).toHaveBeenCalledWith(
			config.arcgisApiKey,
			config.arcgisCustomBasemapUrl,
			handler
		);
	});

	test('falls back to OSM for an unknown provider', () => {
		createMapProvider('not-a-provider', config, handler);
		expect(providers.osm).toHaveBeenCalledWith(handler);
		expect(console.error).toHaveBeenCalledWith(
			'Unknown map provider: not-a-provider; falling back to OSM.'
		);
	});
});
