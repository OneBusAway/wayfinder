import { browser } from '$app/environment';
import StopMarker from '$components/map/StopMarker.svelte';
import PopupContent from '$components/map/PopupContent.svelte';
import VehiclePopupContent from '$components/map/VehiclePopupContent.svelte';
import ContextMenuPopup from '$components/map/ContextMenuPopup.svelte';
import TripPlanPinMarker from '$components/trip-planner/tripPlanPinMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import {
	RouteType,
	routePriorities,
	prioritizedRouteTypeForDisplay,
	SHOW_ROUTE_LABELS_AT_ZOOM
} from '$config/routeConfig';
import { COLORS } from '$lib/colors';
import { polylineArrowColor } from '$lib/colorUtils';
import { createVehicleIconSvg, iconHeight, iconWidth } from '$lib/MapHelpers/generateVehicleIcon';
import { animateMarkerTo, cancelMarkerAnimation } from '$lib/MapHelpers/animateMarker';
import { buildVehiclePopupData } from '$lib/vehicleUtils';
import { ROUTE_PANE } from '$lib/mapPanes.js';
import PolylineUtil from 'polyline-encoded';
import { mount, unmount } from 'svelte';
import './../../assets/styles/arcgis-map.css';

const DEFAULT_BASEMAP = 'streets-navigation-vector';
const DARK_BASEMAP = 'dark-gray-vector';

function chooseStopIcon(stop, requestedIcon) {
	if (requestedIcon) return requestedIcon;
	if (!stop.routes?.length) return faBus;

	const routeTypes = stop.routes.map((route) => route.type);
	for (const priority of routePriorities) {
		if (routeTypes.includes(priority)) return prioritizedRouteTypeForDisplay(priority);
	}
	return prioritizedRouteTypeForDisplay(RouteType.UNKNOWN);
}

function colorWithOpacity(color, opacity = 1) {
	const alpha = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
	if (Array.isArray(color)) return [...color.slice(0, 3), alpha];
	if (typeof color !== 'string') return color;

	const hex = color.replace('#', '');
	const expanded = hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex;
	if (!/^[0-9a-f]{6}$/i.test(expanded)) return color;
	return [
		Number.parseInt(expanded.slice(0, 2), 16),
		Number.parseInt(expanded.slice(2, 4), 16),
		Number.parseInt(expanded.slice(4, 6), 16),
		alpha
	];
}

/** ArcGIS Maps SDK implementation of Wayfinder's map-provider contract. */
export default class ArcGISMapProvider {
	constructor(apiKey, customBasemapUrl, handleStopMarkerSelect) {
		this.apiKey = apiKey;
		this.customBasemapUrl = customBasemapUrl;
		this.handleStopMarkerSelect = handleStopMarkerSelect;
		this.map = null;
		this.view = null;
		this.overlayContainer = null;
		this.markersMap = new Map();
		this.stopsMap = new Map();
		this.stopMarkers = [];
		this.vehicleMarkers = [];
		this.pinMarkers = [];
		this.polylines = [];
		this.userLocationMarker = null;
		this.popupContentComponent = null;
		this.contextMenuComponent = null;
		this.activePopupComponent = null;
		this.globalInfoWindow = null;
		this.showStopsRoutesAtZoom = SHOW_ROUTE_LABELS_AT_ZOOM;
		this.routeLabelsVisible = false;
		this._darkTheme = false;
		this._dimmed = false;
		this._positionFrame = null;
		this._destroyed = false;
		this.handles = new Set();
		this._basemapLayerOpacities = new Map();
	}

	async initMap(element, options) {
		if (!browser) return;
		this._destroyed = false;

		await import('@arcgis/core/assets/esri/themes/light/main.css');
		const modules = await Promise.all([
			import('@arcgis/core/Map.js'),
			import('@arcgis/core/views/MapView.js'),
			import('@arcgis/core/Basemap.js'),
			import('@arcgis/core/layers/VectorTileLayer.js'),
			import('@arcgis/core/layers/GraphicsLayer.js'),
			import('@arcgis/core/Graphic.js'),
			import('@arcgis/core/geometry/Point.js'),
			import('@arcgis/core/geometry/Polyline.js'),
			import('@arcgis/core/geometry/Extent.js'),
			import('@arcgis/core/symbols/SimpleLineSymbol.js'),
			import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
			import('@arcgis/core/symbols/PictureMarkerSymbol.js'),
			import('@arcgis/core/symbols/CIMSymbol.js'),
			import('@arcgis/core/config.js'),
			import('@arcgis/core/core/reactiveUtils.js'),
			import('@arcgis/core/geometry/support/webMercatorUtils.js'),
			import('@arcgis/core/geometry/projection.js')
		]);
		[
			{ default: this.Map },
			{ default: this.MapView },
			{ default: this.Basemap },
			{ default: this.VectorTileLayer },
			{ default: this.GraphicsLayer },
			{ default: this.Graphic },
			{ default: this.Point },
			{ default: this.Polyline },
			{ default: this.Extent },
			{ default: this.SimpleLineSymbol },
			{ default: this.SimpleMarkerSymbol },
			{ default: this.PictureMarkerSymbol },
			{ default: this.CIMSymbol },
			{ default: this.arcgisConfig },
			this.reactiveUtils,
			this.webMercatorUtils,
			this.projection
		] = modules;

		if (this.apiKey) this.arcgisConfig.apiKey = this.apiKey;
		await this.projection.load();

		try {
			const basemap = this.customBasemapUrl
				? new this.Basemap({
						baseLayers: [new this.VectorTileLayer({ url: this.customBasemapUrl })]
					})
				: DEFAULT_BASEMAP;
			this.routeStopLayer = new this.GraphicsLayer({ title: 'Wayfinder route stops' });
			this.vehicleLayer = new this.GraphicsLayer({ title: 'Wayfinder vehicles' });
			this.userLocationLayer = new this.GraphicsLayer({ title: 'Wayfinder user location' });
			this.routeCasingLayer = new this.GraphicsLayer({ title: 'Wayfinder route casings' });
			this.routeLineLayer = new this.GraphicsLayer({ title: 'Wayfinder routes' });
			this.routePromotedLayer = new this.GraphicsLayer({ title: 'Wayfinder promoted routes' });
			this.map = new this.Map({
				basemap,
				layers: [
					this.routeCasingLayer,
					this.routeLineLayer,
					this.routePromotedLayer,
					this.routeStopLayer,
					this.vehicleLayer,
					this.userLocationLayer
				]
			});
			this.view = new this.MapView({
				container: element,
				map: this.map,
				center: [options.lng, options.lat],
				zoom: 14,
				ui: { components: ['zoom', 'attribution'] },
				// The default popup docks itself on narrow map views. Wayfinder's map can
				// be narrow while the browser is not (for example beside the trip pane),
				// which made a small context menu turn into a full-width sheet.
				popup: {
					dockEnabled: false,
					dockOptions: { breakpoint: false, buttonEnabled: false },
					actions: [],
					autoCloseEnabled: true,
					defaultPopupTemplateEnabled: false,
					highlightEnabled: false,
					visibleElements: {
						closeButton: true,
						collapseButton: false,
						heading: false,
						actionBar: false,
						featureNavigation: false,
						featureMenuHeading: false,
						featureListLayerTitle: false
					}
				},
				constraints: { rotationEnabled: false }
			});
			await this.view.when();
			this._ensureOverlayContainer();
			this._registerSharedHandles();
		} catch (error) {
			this.destroy();
			throw error;
		}
	}

	_registerSharedHandles() {
		this._trackHandle(
			this.reactiveUtils.watch(
				() => [this.view?.extent, this.view?.zoom, this.view?.stationary],
				() => this._requestPositionUpdate()
			)
		);
		this._trackHandle(
			this.reactiveUtils.watch(
				() => this.view?.popup?.visible,
				(visible) => {
					if (!visible) this._cleanupPopupComponent();
				}
			)
		);
		this.mapClickHandle = this._trackHandle(
			this.view.on('click', async (event) => {
				try {
					const response = await this.view?.hitTest(event);
					this._handleHitTestResults(response?.results ?? []);
				} catch (error) {
					if (this.view && !this._destroyed) console.warn('ArcGIS hitTest failed', error);
				}
			})
		);
	}

	_trackHandle(handle) {
		if (handle?.remove) this.handles.add(handle);
		return handle;
	}

	_removeHandles() {
		for (const handle of this.handles) {
			try {
				handle.remove();
			} catch {
				// SDK handles can already be removed while a failed view is torn down.
			}
		}
		this.handles.clear();
	}

	_ensureOverlayContainer() {
		if (this.overlayContainer || !this.view?.container) return this.overlayContainer;
		this.overlayContainer = document.createElement('div');
		this.overlayContainer.className = 'arcgis-overlay-container';
		this.view.container.appendChild(this.overlayContainer);
		return this.overlayContainer;
	}

	_requestPositionUpdate() {
		if (this._positionFrame != null) return;
		if (typeof requestAnimationFrame !== 'function') {
			this._updateAllMarkerPositions();
			return;
		}
		this._positionFrame = requestAnimationFrame(() => {
			this._positionFrame = null;
			this._updateAllMarkerPositions();
		});
	}

	_updateAllMarkerPositions() {
		for (const marker of this.markersMap.values()) this._updateMarkerPosition(marker);
		for (const marker of this.pinMarkers) this._updateMarkerPosition(marker);
	}

	_updateMarkerPosition(marker) {
		if (!marker?.element || !this.view) return;
		const screenPoint = this.view.toScreen(marker.point);
		if (!screenPoint || !Number.isFinite(screenPoint.x) || !Number.isFinite(screenPoint.y)) {
			marker.element.style.display = 'none';
			return;
		}
		marker.element.style.display = '';
		marker.element.style.transform = `translate3d(${screenPoint.x}px, ${screenPoint.y}px, 0) translate(-50%, -50%)`;
	}

	eventListeners(_mapInstance, debouncedLoadMarkers) {
		if (!this.view || this.viewportLoadHandle) return;
		this.viewportLoadHandle = this._trackHandle(
			this.reactiveUtils.watch(
				() => this.view?.stationary,
				(stationary, previous) => {
					if (stationary && previous === false) debouncedLoadMarkers();
				}
			)
		);
	}

	addMarker(options) {
		if (!browser || !this.view || this.markersMap.has(options.stop.id)) {
			return this.markersMap.get(options.stop.id) ?? null;
		}
		const element = document.createElement('div');
		element.className = 'arcgis-stop-marker-overlay';
		const props = $state({
			stop: options.stop,
			icon: chooseStopIcon(options.stop, options.icon),
			onClick: options.onClick,
			isHighlighted: options.isHighlighted ?? false,
			showRoutesLabel: this.getZoom() >= this.showStopsRoutesAtZoom,
			emphasis: options.emphasis ?? 'full',
			dotColor: options.dotColor ?? null
		});
		const component = mount(StopMarker, { target: element, props });
		this._ensureOverlayContainer().appendChild(element);
		const marker = {
			id: options.stop.id,
			point: new this.Point({ longitude: options.position.lng, latitude: options.position.lat }),
			element,
			component,
			props
		};
		this.markersMap.set(marker.id, marker);
		this._updateMarkerPosition(marker);
		return marker;
	}

	removeMarker(marker) {
		if (!marker) return;
		if (marker.component) unmount(marker.component);
		marker.element?.remove();
		for (const [id, stored] of this.markersMap) {
			if (stored === marker) this.markersMap.delete(id);
		}
	}

	hasMarker(stopId) {
		return this.markersMap.has(stopId);
	}

	getMarker(stopId) {
		return this.markersMap.get(stopId);
	}

	clearAllStopMarkers() {
		for (const marker of [...this.markersMap.values()]) this.removeMarker(marker);
		this.markersMap.clear();
	}

	updateMarkersRouteLabelVisibility() {
		const visible = this.getZoom() >= this.showStopsRoutesAtZoom;
		if (visible === this.routeLabelsVisible) return;
		this.routeLabelsVisible = visible;
		for (const marker of this.markersMap.values()) marker.props.showRoutesLabel = visible;
	}

	highlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (marker) marker.props.isHighlighted = true;
	}

	unHighlightMarker(stopId) {
		const marker = this.markersMap.get(stopId);
		if (marker) marker.props.isHighlighted = false;
	}

	setStopEmphasis(byStopId, defaultEmphasis = 'full', selectedStopId = null) {
		for (const [stopId, marker] of this.markersMap) {
			const tier = byStopId.get(stopId);
			marker.props.emphasis =
				stopId === selectedStopId ? 'full' : (tier?.emphasis ?? defaultEmphasis);
			marker.props.dotColor = stopId === selectedStopId ? null : (tier?.dotColor ?? null);
		}
	}

	resetStopEmphasis() {
		for (const marker of this.markersMap.values()) {
			marker.props.emphasis = 'full';
			marker.props.dotColor = null;
		}
	}

	addStopRouteMarker(stop, stopTime = null) {
		if (!this.routeStopLayer) return null;
		const graphic = new this.Graphic({
			geometry: new this.Point({ longitude: stop.lon, latitude: stop.lat }),
			symbol: new this.SimpleMarkerSymbol({
				style: 'circle',
				color: [255, 255, 255, 1],
				size: 10,
				outline: { color: [0, 0, 0, 1], width: 1 }
			}),
			attributes: { kind: 'route-stop', stopId: stop.id, stopTime }
		});
		this.routeStopLayer.add(graphic);
		this.stopMarkers.push(graphic);
		this.stopsMap.set(stop.id, stop);
		return graphic;
	}

	removeStopMarkers() {
		this.routeStopLayer?.removeMany(this.stopMarkers);
		this.stopMarkers = [];
	}

	_handleHitTestResults(results) {
		const hit = results.find(({ graphic }) =>
			[this.routeStopLayer, this.vehicleLayer].includes(graphic?.layer)
		);
		const attributes = hit?.graphic?.attributes;
		if (!attributes) return;
		if (attributes.kind === 'route-stop') {
			const stop = this.stopsMap.get(attributes.stopId);
			if (stop) this.openStopMarker(stop, attributes.stopTime ?? null);
		} else if (attributes.kind === 'vehicle') {
			const marker = this.vehicleMarkers.find((item) => item.graphic === hit.graphic);
			if (marker) this._openVehiclePopup(marker);
		}
	}

	_cleanupPopupComponent() {
		if (this.activePopupComponent) unmount(this.activePopupComponent);
		if (this.contextMenuComponent === this.activePopupComponent) {
			this.contextMenuComponent = null;
		}
		this.activePopupComponent = null;
		this.popupContentComponent = null;
		this.globalInfoWindow = null;
	}

	_setPopupChrome({ closeButton }) {
		const popup = this.view?.popup;
		if (!popup) return;

		popup.dockEnabled = false;
		popup.actions?.removeAll?.();
		Object.assign(popup.visibleElements ?? (popup.visibleElements = {}), {
			closeButton,
			collapseButton: false,
			heading: false,
			actionBar: false,
			featureNavigation: false,
			featureMenuHeading: false,
			featureListLayerTitle: false
		});
	}

	openStopMarker(stop, stopTime = null) {
		if (!this.view) return;
		this.cleanupInfoWindow();
		this._setPopupChrome({ closeButton: true });
		const container = document.createElement('div');
		this.popupContentComponent = mount(PopupContent, {
			target: container,
			props: {
				stopName: stop.name,
				arrivalTime: stopTime?.arrivalTime ?? null,
				handleStopMarkerSelect: () => this.handleStopMarkerSelect(stop)
			}
		});
		this.activePopupComponent = this.popupContentComponent;
		this.globalInfoWindow = this.view.popup;
		this.view.openPopup({
			location: { longitude: stop.lon, latitude: stop.lat },
			content: container
		});
	}

	updatePopupContent(stop, arrivalTime = null) {
		if (!this.popupContentComponent || !this.view?.popup?.visible) return;
		this.openStopMarker(stop, { arrivalTime });
	}

	cleanupInfoWindow() {
		this._cleanupPopupComponent();
		if (this.view?.popup?.visible) this.view.popup.close();
	}

	addPinMarker(position, text) {
		if (!this.view) return null;
		const element = document.createElement('div');
		element.className = 'arcgis-pin-marker-overlay';
		const component = mount(TripPlanPinMarker, { target: element, props: { text } });
		this._ensureOverlayContainer().appendChild(element);
		const marker = {
			point: new this.Point({ longitude: position.lng, latitude: position.lat }),
			element,
			component
		};
		this.pinMarkers.push(marker);
		this._updateMarkerPosition(marker);
		return marker;
	}

	removePinMarker(marker) {
		if (!marker) return;
		if (marker.component) unmount(marker.component);
		marker.element?.remove();
		this.pinMarkers = this.pinMarkers.filter((item) => item !== marker);
	}

	addVehicleMarker(vehicle, activeTrip, routeType, isHighlighted = false, routeColor = undefined) {
		if (!this.vehicleLayer) return null;
		const color = vehicle.predicted ? routeColor : COLORS.VEHICLE_REAL_TIME_OFF;
		const icon = createVehicleIconSvg(vehicle.orientation, color, routeType, isHighlighted);
		const graphic = new this.Graphic({
			geometry: new this.Point({ longitude: vehicle.position.lon, latitude: vehicle.position.lat }),
			symbol: new this.PictureMarkerSymbol({
				url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(icon)}`,
				width: `${iconWidth}px`,
				height: `${iconHeight}px`
			}),
			attributes: { kind: 'vehicle', vehicleId: vehicle.vehicleId }
		});
		const vehicleData = $state(buildVehiclePopupData(vehicle, activeTrip, this.stopsMap));
		const marker = { graphic, vehicleData };
		this.vehicleLayer.add(graphic);
		this.vehicleMarkers.push(marker);
		return marker;
	}

	_openVehiclePopup(marker) {
		if (!this.view) return;
		this.cleanupInfoWindow();
		this._setPopupChrome({ closeButton: true });
		const container = document.createElement('div');
		this.activePopupComponent = mount(VehiclePopupContent, {
			target: container,
			props: marker.vehicleData
		});
		this.view.openPopup({ location: marker.graphic.geometry, content: container });
	}

	updateVehicleMarker(
		marker,
		vehicleStatus,
		activeTrip,
		routeType,
		isHighlighted = false,
		routeColor = undefined
	) {
		if (!marker?.graphic || !this.view) return;
		const current = marker.graphic.geometry;
		animateMarkerTo(
			marker,
			{ lat: current.latitude, lng: current.longitude },
			{ lat: vehicleStatus.position.lat, lng: vehicleStatus.position.lon },
			(lat, lng) => {
				marker.graphic.geometry = new this.Point({ longitude: lng, latitude: lat });
			},
			{ routePaths: this._getRoutePaths() }
		);
		const color = vehicleStatus.predicted ? routeColor : COLORS.VEHICLE_REAL_TIME_OFF;
		marker.graphic.symbol = new this.PictureMarkerSymbol({
			url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(createVehicleIconSvg(vehicleStatus.orientation, color, routeType, isHighlighted))}`,
			width: `${iconWidth}px`,
			height: `${iconHeight}px`
		});
		Object.assign(
			marker.vehicleData,
			buildVehiclePopupData(vehicleStatus, activeTrip, this.stopsMap)
		);
	}

	removeVehicleMarker(marker) {
		if (!marker) return;
		cancelMarkerAnimation(marker);
		this.vehicleLayer?.remove(marker.graphic);
		this.vehicleMarkers = this.vehicleMarkers.filter((item) => item !== marker);
	}

	clearVehicleMarkers() {
		for (const marker of [...this.vehicleMarkers]) this.removeVehicleMarker(marker);
	}

	_getRoutePaths() {
		return this.polylines
			.map((polyline) => polyline.geometry?.paths?.[0] ?? [])
			.filter((path) => path.length >= 2)
			.map((path) => path.map(([lng, lat]) => ({ lat, lng })));
	}

	addUserLocationMarker(latLng) {
		if (!this.userLocationLayer) return null;
		if (this.userLocationMarker) {
			this.userLocationMarker.geometry = new this.Point({
				longitude: latLng.lng,
				latitude: latLng.lat
			});
			return this.userLocationMarker;
		}
		this.userLocationMarker = new this.Graphic({
			geometry: new this.Point({ longitude: latLng.lng, latitude: latLng.lat }),
			symbol: new this.SimpleMarkerSymbol({
				style: 'circle',
				color: '#007BFF',
				size: 16,
				outline: { color: '#FFFFFF', width: 2 }
			})
		});
		this.userLocationLayer.add(this.userLocationMarker);
		return this.userLocationMarker;
	}

	removeUserLocationMarker() {
		if (this.userLocationMarker) this.userLocationLayer?.remove(this.userLocationMarker);
		this.userLocationMarker = null;
	}

	setCenter(latLng) {
		if (this.view) this.view.center = [latLng.lng, latLng.lat];
	}

	getCenter() {
		if (!this.view?.center) return { lat: 0, lng: 0 };
		return { lat: this.view.center.latitude, lng: this.view.center.longitude };
	}

	getZoom() {
		return this.view?.zoom ?? 0;
	}

	setTheme(theme) {
		this._darkTheme = theme === 'dark';
		if (!this.map || this.customBasemapUrl) return;
		this.map.basemap = this._darkTheme ? DARK_BASEMAP : DEFAULT_BASEMAP;
		this.setBasemapDimmed(this._dimmed);
	}

	setBasemapDimmed(dimmed) {
		this._dimmed = dimmed;
		const layers = this.map?.basemap?.baseLayers;
		if (!layers) return;
		layers.forEach((layer) => {
			if (!this._basemapLayerOpacities.has(layer))
				this._basemapLayerOpacities.set(layer, layer.opacity ?? 1);
			layer.opacity = dimmed
				? Math.min(this._basemapLayerOpacities.get(layer), 0.6)
				: this._basemapLayerOpacities.get(layer);
		});
	}

	_createRouteSymbol(color, weight, opacity, withArrow) {
		const symbolColor = colorWithOpacity(color, opacity);
		if (!withArrow)
			return new this.SimpleLineSymbol({ color: symbolColor, width: weight, style: 'solid' });
		const arrowColor = colorWithOpacity(polylineArrowColor(color), opacity);
		return new this.CIMSymbol({
			data: {
				type: 'CIMSymbolReference',
				data: {
					type: 'CIMLineSymbol',
					symbolLayers: [
						{ type: 'CIMSolidStroke', enable: true, width: weight, color: symbolColor },
						{
							type: 'CIMVectorMarker',
							enable: true,
							markerPlacement: {
								type: 'CIMMarkerPlacementAlongLineSameSize',
								placementTemplate: [50],
								endings: 'WithMarkers'
							},
							markerGraphics: [
								{
									type: 'CIMMarkerGraphic',
									geometry: {
										rings: [
											[
												[0, 6],
												[6, -6],
												[-6, -6],
												[0, 6]
											]
										]
									},
									symbol: {
										type: 'CIMPolygonSymbol',
										symbolLayers: [{ type: 'CIMSolidFill', enable: true, color: arrowColor }]
									}
								}
							]
						}
					]
				}
			}
		});
	}

	createPolyline(shape, options = {}) {
		if (!this.routeLineLayer) return null;
		if (typeof options === 'boolean') options = { withArrow: options };
		let decoded;
		try {
			decoded = PolylineUtil.decode(shape);
		} catch (error) {
			console.error('Failed to decode polyline:', error?.message);
			return null;
		}
		if (!decoded?.length) return null;
		const paths = decoded.map(([lat, lng]) => [lng, lat]);
		const geometry = new this.Polyline({ paths: [paths], spatialReference: { wkid: 4326 } });
		const weight = options.weight || 4;
		const color = options.color || COLORS.POLYLINE;
		const withArrow = options.withArrow ?? true;
		const graphic = new this.Graphic({
			geometry,
			symbol: this._createRouteSymbol(color, weight, options.opacity ?? 1, withArrow)
		});
		if (options.casing) {
			graphic._casing = new this.Graphic({
				geometry,
				symbol: new this.SimpleLineSymbol({
					color: '#ffffff',
					width: weight + 5,
					style: 'solid',
					opacity: 0.95
				})
			});
			this.routeCasingLayer.add(graphic._casing);
		}
		graphic._layer =
			options.pane === ROUTE_PANE.PROMOTED ? this.routePromotedLayer : this.routeLineLayer;
		graphic._layer.add(graphic);
		this.polylines.push(graphic);
		return graphic;
	}

	setPolylineLayer(polyline, pane) {
		if (!polyline) return;
		const target = pane === ROUTE_PANE.PROMOTED ? this.routePromotedLayer : this.routeLineLayer;
		if (!target || polyline._layer === target) return;
		polyline._layer?.remove(polyline);
		target.add(polyline);
		polyline._layer = target;
	}

	removePolyline(polyline) {
		if (!polyline) return null;
		polyline._layer?.remove(polyline);
		if (polyline._casing) this.routeCasingLayer?.remove(polyline._casing);
		this.polylines = this.polylines.filter((item) => item !== polyline);
		return null;
	}

	clearAllPolylines() {
		for (const polyline of [...this.polylines]) this.removePolyline(polyline);
	}

	getPolylinesCount() {
		return this.polylines.length;
	}

	panTo(lat, lng) {
		this.view?.goTo({ center: [lng, lat] }).catch(() => {});
	}

	flyTo(lat, lng, zoom = 15, options = {}) {
		if (!this.view) return;
		this.view
			.goTo({ center: [lng, lat], zoom }, { animate: options.animate ?? true })
			.catch(() => {});
	}

	setZoom(zoom) {
		if (this.view) this.view.zoom = zoom;
	}

	async fitToPolylines(options = {}) {
		if (!this.view || !this.polylines.length) return false;
		try {
			await this.view.goTo(this.polylines, { duration: options.duration ?? 700 });
			if (this.view.zoom > (options.maxZoom ?? 16)) this.view.zoom = options.maxZoom ?? 16;
			return true;
		} catch {
			return false;
		}
	}

	revealPolylines() {}

	addListener(event, callback) {
		if (!this.view) return null;
		const watchable = new Set(['zoom', 'center', 'extent', 'stationary', 'updating']);
		return this._trackHandle(
			watchable.has(event)
				? this.reactiveUtils.watch(() => this.view?.[event], callback)
				: this.view.on(event, callback)
		);
	}

	enableContextMenu() {
		if (!this.view || this.contextMenuHandle) return;
		this.contextMenuHandle = this._trackHandle(
			this.view.on('immediate-click', (event) => {
				if (event.button === 2 && event.mapPoint) this.showContextMenu(event.mapPoint);
			})
		);
	}

	showContextMenu(point) {
		if (!this.view) return;
		this.cleanupInfoWindow();
		// Context actions already close after a selection and match the existing
		// OSM behaviour, so omit the otherwise useful popup close control here.
		this._setPopupChrome({ closeButton: false });
		const container = document.createElement('div');
		const dispatchAndClose = (type) => {
			window.dispatchEvent(
				new CustomEvent('contextMenuTripPlan', {
					detail: { type, lat: point.latitude, lng: point.longitude }
				})
			);
			this.closeContextMenu();
		};
		this.contextMenuComponent = mount(ContextMenuPopup, {
			target: container,
			props: {
				onStartHere: () => dispatchAndClose('from'),
				onEndHere: () => dispatchAndClose('to')
			}
		});
		this.activePopupComponent = this.contextMenuComponent;
		this.view.openPopup({ location: point, content: container });
	}

	closeContextMenu() {
		if (!this.contextMenuComponent) return;
		this._cleanupPopupComponent();
		this.view?.popup?.close();
	}

	getBoundingBox() {
		const extent = this.view?.extent;
		if (!extent) return null;
		let geographic = extent;
		try {
			if (!extent.spatialReference?.isWGS84) {
				geographic = this.webMercatorUtils.isWebMercator(extent)
					? this.webMercatorUtils.webMercatorToGeographic(extent)
					: this.projection.project(extent, { wkid: 4326 });
			}
		} catch {
			return null;
		}
		const bounds = {
			north: geographic?.ymax,
			south: geographic?.ymin,
			east: geographic?.xmax,
			west: geographic?.xmin
		};
		return Object.values(bounds).every(Number.isFinite) ? bounds : null;
	}

	destroy() {
		if (this._destroyed) return;
		this._destroyed = true;
		if (this._positionFrame != null && typeof cancelAnimationFrame === 'function')
			cancelAnimationFrame(this._positionFrame);
		this._positionFrame = null;
		this._removeHandles();
		this.cleanupInfoWindow();
		this.closeContextMenu();
		this.clearAllStopMarkers();
		this.removeStopMarkers();
		this.clearVehicleMarkers();
		for (const marker of [...this.pinMarkers]) this.removePinMarker(marker);
		this.clearAllPolylines();
		this.removeUserLocationMarker();
		this.overlayContainer?.remove();
		this.overlayContainer = null;
		this.view?.destroy();
		this.view = null;
		this.map = null;
		this.routeStopLayer = null;
		this.vehicleLayer = null;
		this.userLocationLayer = null;
		this.routeCasingLayer = null;
		this.routeLineLayer = null;
		this.routePromotedLayer = null;
		this.stopsMap.clear();
		this._basemapLayerOpacities.clear();
	}
}
