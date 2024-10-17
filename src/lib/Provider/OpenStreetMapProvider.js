import { browser } from '$app/environment';
import StopMarker from '$components/map/StopMarker.svelte';
import { faBus } from '@fortawesome/free-solid-svg-icons';
import './../../assets/styles/leaflet-map.css';
import PolylineUtil from 'polyline-encoded';
import { COLORS } from '$lib/colors';

export default class OpenStreetMapProvider {
	constructor() {
		this.map = null;
		this.L = null;
	}

	async initMap(element, options) {
		if (!browser) {
			return;
		}

		const leaflet = await import('leaflet');
		import('leaflet-polylinedecorator');

		this.L = leaflet.default;

		// Leaflet CSS
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css';
		document.head.appendChild(link);

		this.map = this.L.map(element, { zoomControl: false }).setView([options.lat, options.lng], 14);

		this.L.control
			.zoom({
				position: 'bottomright'
			})
			.addTo(this.map);

		this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(this.map);
	}

	addMarker(options) {
		if (!browser || !this.map) return null;

		const container = document.createElement('div');

		new StopMarker({
			target: container,
			props: {
				stop: options.stop,
				icon: faBus,
				onClick: options.onClick || (() => {})
			}
		});

		const customIcon = this.L.divIcon({
			html: container,
			className: '',
			iconSize: [40, 40]
		});

		const marker = this.L.marker([options.position.lat, options.position.lng], {
			icon: customIcon
		}).addTo(this.map);

		return marker;
	}

	addListener(event, callback) {
		if (!browser || !this.map) return;
		this.map.on(event, callback);
	}

	addUserLocationMarker(latLng) {
		if (!browser || !this.map) return;
		this.L.circleMarker([latLng.lat, latLng.lng], {
			radius: 8,
			fillColor: '#007BFF',
			fillOpacity: 1,
			color: '#FFFFFF',
			weight: 2
		}).addTo(this.map);
	}

	setCenter(latLng) {
		if (!browser || !this.map) return;
		this.map.setView([latLng.lat, latLng.lng]);
	}

	getCenter() {
		if (!browser || !this.map) return { lat: 0, lng: 0 };
		const center = this.map.getCenter();
		return { lat: center.lat, lng: center.lng };
	}

	removeMarker(marker) {
		if (!browser || !this.map) return;
		this.map.removeLayer(marker);
	}

	setTheme(theme) {
		console.log('TODO: implement setTheme for OpenStreetMapProvider', theme);
	}

	createPolyline(points) {
		if (!browser || !this.map) return null;

		const decodedPolyline = PolylineUtil.decode(points);
		if (!decodedPolyline || decodedPolyline.length === 0) {
			console.error('Failed to decode polyline:', points);
			return null;
		}

		const polyline = new this.L.Polyline(decodedPolyline, {
			color: COLORS.POLYLINE,
			weight: 4,
			opacity: 1.0
		}).addTo(this.map);

		this.addArrowsToPolyline(polyline);

		return polyline;
	}

	addArrowsToPolyline(polyline) {
		if (!browser || !this.map || !polyline) return null;

		this.arrowDecorator = this.L.polylineDecorator(polyline, {
			patterns: [
				{
					offset: 0,
					repeat: 50,
					symbol: this.L.Symbol.arrowHead({
						pixelSize: 10,
						pathOptions: {
							color: COLORS.POLYLINE_ARROW,
							fillOpacity: 1
						}
					})
				}
			]
		}).addTo(this.map);
	}

	removePolyline(polyline) {
		if (polyline) {
			polyline.remove();
		}
		if (this.arrowDecorator) {
			this.arrowDecorator.remove();
			this.arrowDecorator = null;
		}
	}
}