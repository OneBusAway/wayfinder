import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({
	browser: true,
	dev: false,
	building: false,
	version: 'test'
}));
vi.mock('@arcgis/core/assets/esri/themes/light/main.css', () => ({}));

const sdk = vi.hoisted(() => {
	class Handle {
		remove = vi.fn();
	}
	class GraphicsLayer {
		constructor(properties = {}) {
			Object.assign(this, properties);
			this.graphics = [];
		}
		add(graphic) {
			graphic.layer = this;
			this.graphics.push(graphic);
		}
		remove(graphic) {
			this.graphics = this.graphics.filter((item) => item !== graphic);
		}
		removeMany(graphics) {
			graphics.forEach((graphic) => this.remove(graphic));
		}
	}
	class Graphic {
		constructor(properties) {
			Object.assign(this, properties);
		}
	}
	class Point {
		constructor(properties) {
			Object.assign(this, properties);
		}
	}
	class Polyline {
		constructor(properties) {
			Object.assign(this, properties);
		}
	}
	class Symbol {
		constructor(properties) {
			Object.assign(this, properties);
		}
	}
	class Map {
		constructor(properties) {
			Object.assign(this, properties);
		}
	}
	class Basemap {
		constructor(properties) {
			Object.assign(this, properties);
		}
	}
	class VectorTileLayer {
		constructor(properties) {
			Object.assign(this, properties);
			this.opacity = 1;
		}
	}
	class MapView {
		static whenResult = Promise.resolve();
		constructor(properties) {
			Object.assign(this, properties);
			this.center = { latitude: properties.center[1], longitude: properties.center[0] };
			this.zoom = properties.zoom;
			this.extent = {
				xmin: -123,
				ymin: 47,
				xmax: -122,
				ymax: 48,
				spatialReference: { isWGS84: true }
			};
			this.popup = {
				...properties.popup,
				visible: false,
				close: vi.fn(() => (this.popup.visible = false))
			};
			this.on = vi.fn(() => new Handle());
			this.hitTest = vi.fn();
			this.goTo = vi.fn().mockResolvedValue();
			this.destroy = vi.fn();
			this.toScreen = vi.fn((point) => ({ x: point.longitude, y: point.latitude }));
		}
		when() {
			return MapView.whenResult;
		}
		openPopup = vi.fn((options) => {
			this.popup.visible = true;
			this.popup.content = options.content;
		});
	}
	const reactiveUtils = { watch: vi.fn(() => new Handle()) };
	const projection = { load: vi.fn().mockResolvedValue(), project: vi.fn((value) => value) };
	return {
		Handle,
		GraphicsLayer,
		Graphic,
		Point,
		Polyline,
		Symbol,
		Map,
		Basemap,
		VectorTileLayer,
		MapView,
		reactiveUtils,
		projection,
		webMercatorUtils: {
			isWebMercator: vi.fn(() => true),
			webMercatorToGeographic: vi.fn((extent) => ({
				...extent,
				xmin: -122.4,
				ymin: 47.5,
				xmax: -122.2,
				ymax: 47.7
			}))
		}
	};
});

vi.mock('@arcgis/core/Map.js', () => ({ default: sdk.Map }));
vi.mock('@arcgis/core/views/MapView.js', () => ({ default: sdk.MapView }));
vi.mock('@arcgis/core/Basemap.js', () => ({ default: sdk.Basemap }));
vi.mock('@arcgis/core/layers/VectorTileLayer.js', () => ({ default: sdk.VectorTileLayer }));
vi.mock('@arcgis/core/layers/GraphicsLayer.js', () => ({ default: sdk.GraphicsLayer }));
vi.mock('@arcgis/core/Graphic.js', () => ({ default: sdk.Graphic }));
vi.mock('@arcgis/core/geometry/Point.js', () => ({ default: sdk.Point }));
vi.mock('@arcgis/core/geometry/Polyline.js', () => ({ default: sdk.Polyline }));
vi.mock('@arcgis/core/geometry/Extent.js', () => ({ default: class {} }));
vi.mock('@arcgis/core/symbols/SimpleLineSymbol.js', () => ({ default: sdk.Symbol }));
vi.mock('@arcgis/core/symbols/SimpleMarkerSymbol.js', () => ({ default: sdk.Symbol }));
vi.mock('@arcgis/core/symbols/PictureMarkerSymbol.js', () => ({ default: sdk.Symbol }));
vi.mock('@arcgis/core/symbols/CIMSymbol.js', () => ({ default: sdk.Symbol }));
vi.mock('@arcgis/core/config.js', () => ({ default: {} }));
vi.mock('@arcgis/core/core/reactiveUtils.js', () => sdk.reactiveUtils);
vi.mock('@arcgis/core/geometry/support/webMercatorUtils.js', () => sdk.webMercatorUtils);
vi.mock('@arcgis/core/geometry/projection.js', () => sdk.projection);

import ArcGISMapProvider from '$lib/Provider/ArcGISMapProvider.svelte.js';

const SHAPE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

async function initializedProvider({ customBasemapUrl = '' } = {}) {
	const provider = new ArcGISMapProvider('key', customBasemapUrl, vi.fn());
	await provider.initMap(document.createElement('div'), { lat: 47.6, lng: -122.3 });
	return provider;
}

describe('ArcGISMapProvider', () => {
	beforeEach(() => {
		sdk.MapView.whenResult = Promise.resolve();
		sdk.reactiveUtils.watch.mockClear();
		sdk.projection.load.mockClear();
	});

	test('initializes optional API key, custom basemap, shared handlers, and overlay', async () => {
		const provider = await initializedProvider({
			customBasemapUrl: 'https://tiles.example.test/style.json'
		});
		expect(provider.map.basemap.baseLayers[0].url).toBe('https://tiles.example.test/style.json');
		expect(provider.overlayContainer.className).toBe('arcgis-overlay-container');
		expect(provider.view.on).toHaveBeenCalledTimes(1);
		expect(sdk.reactiveUtils.watch).toHaveBeenCalledTimes(2);
		expect(provider.view.popup.dockOptions).toEqual({ breakpoint: false, buttonEnabled: false });
		expect(provider.view.popup.visibleElements).toMatchObject({
			actionBar: false,
			collapseButton: false,
			closeButton: true
		});
	});

	test('cleans up partial state when view.when rejects', async () => {
		sdk.MapView.whenResult = Promise.reject(new Error('WebGL unavailable'));
		const provider = new ArcGISMapProvider('', '', vi.fn());
		await expect(
			provider.initMap(document.createElement('div'), { lat: 1, lng: 2 })
		).rejects.toThrow('WebGL unavailable');
		expect(provider.view).toBeNull();
		expect(provider.map).toBeNull();
	});

	test('preserves a custom basemap during theme changes and dims only its base layer', async () => {
		const provider = await initializedProvider({
			customBasemapUrl: 'https://tiles.example.test/style.json'
		});
		const basemap = provider.map.basemap;
		provider.setTheme('dark');
		expect(provider.map.basemap).toBe(basemap);
		provider.setBasemapDimmed(true);
		expect(basemap.baseLayers[0].opacity).toBe(0.6);
		provider.setBasemapDimmed(false);
		expect(basemap.baseLayers[0].opacity).toBe(1);
	});

	test('keeps the context menu compact and closes its mounted content cleanly', async () => {
		const provider = await initializedProvider();
		provider.showContextMenu({ latitude: 47.6, longitude: -122.3 });

		expect(provider.view.popup.visibleElements).toMatchObject({
			closeButton: false,
			actionBar: false,
			collapseButton: false
		});
		expect(provider.view.popup.dockEnabled).toBe(false);
		expect(provider.contextMenuComponent).not.toBeNull();

		provider.closeContextMenu();
		expect(provider.contextMenuComponent).toBeNull();
		expect(provider.view.popup.close).toHaveBeenCalledTimes(1);
	});

	test('returns WGS84 bounds and null when no extent is available', async () => {
		const provider = await initializedProvider();
		provider.view.extent = {
			xmin: 0,
			ymin: 0,
			xmax: 0,
			ymax: 0,
			spatialReference: { isWGS84: false }
		};
		expect(provider.getBoundingBox()).toEqual({
			north: 47.7,
			south: 47.5,
			east: -122.2,
			west: -122.4
		});
		provider.view.extent = null;
		expect(provider.getBoundingBox()).toBeNull();
	});

	test('creates synchronous, WGS84-converted polylines with opacity, casing, and arrows', async () => {
		const provider = await initializedProvider();
		const polyline = provider.createPolyline(SHAPE, {
			color: '#112233',
			opacity: 0.5,
			weight: 7,
			casing: true
		});
		expect(polyline).not.toBeInstanceOf(Promise);
		expect(polyline.geometry.paths[0][0]).toEqual([-120.2, 38.5]);
		expect(polyline.symbol.data.data.symbolLayers).toHaveLength(2);
		expect(polyline._casing).toBeTruthy();
		provider.removePolyline(polyline);
		expect(provider.getPolylinesCount()).toBe(0);
		expect(provider.routeCasingLayer.graphics).toHaveLength(0);
	});

	test('uses the latest vehicle data for a shared hit-test popup and clears popup components on close', async () => {
		const provider = await initializedProvider();
		const marker = provider.addVehicleMarker(
			{
				vehicleId: 'vehicle-1',
				position: { lat: 47.6, lon: -122.3 },
				orientation: 0,
				predicted: true,
				lastUpdateTime: 1,
				nextStop: 'old-stop'
			},
			{ tripHeadsign: 'Old destination' },
			3
		);
		provider.updateVehicleMarker(
			marker,
			{
				vehicleId: 'vehicle-1',
				position: { lat: 47.61, lon: -122.31 },
				orientation: 90,
				predicted: true,
				lastUpdateTime: 2,
				nextStop: 'new-stop'
			},
			{ tripHeadsign: 'New destination' },
			3
		);
		expect(marker.vehicleData.nextDestination).toBe('New destination');

		const clickHandler = provider.view.on.mock.calls[0][1];
		provider.view.hitTest.mockResolvedValue({ results: [{ graphic: marker.graphic }] });
		await clickHandler({});
		expect(provider.view.openPopup).toHaveBeenCalledWith(
			expect.objectContaining({ location: marker.graphic.geometry })
		);

		const popupWatch = sdk.reactiveUtils.watch.mock.calls[1][1];
		popupWatch(false);
		expect(provider.activePopupComponent).toBeNull();
	});

	test('hides off-screen HTML markers, catches hit-test errors, and safely destroys twice', async () => {
		const provider = await initializedProvider();
		const marker = provider.addMarker({
			stop: { id: 's1', name: 'Stop', routes: [] },
			position: { lat: 47.6, lng: -122.3 }
		});
		provider.view.toScreen.mockReturnValue(null);
		provider._updateMarkerPosition(marker);
		expect(marker.element.style.display).toBe('none');
		const clickHandler = provider.view.on.mock.calls[0][1];
		provider.view.hitTest.mockRejectedValue(new Error('destroyed'));
		await clickHandler({});
		expect(console.warn).toHaveBeenCalledWith('ArcGIS hitTest failed', expect.any(Error));
		const handles = [...provider.handles];
		provider.destroy();
		provider.destroy();
		expect(handles.every((handle) => handle.remove.mock.calls.length === 1)).toBe(true);
	});
});
