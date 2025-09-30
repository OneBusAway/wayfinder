import { vi } from 'vitest';

export const mockLeafletMap = {
	setView: vi.fn(),
	addLayer: vi.fn(),
	removeLayer: vi.fn(),
	on: vi.fn(),
	off: vi.fn(),
	fitBounds: vi.fn(),
	getZoom: vi.fn(() => 15),
	getCenter: vi.fn(() => ({ lat: 47.6062, lng: -122.3321 })),
	invalidateSize: vi.fn(),
	remove: vi.fn(),
	eachLayer: vi.fn(),
	hasLayer: vi.fn(() => false),
	getPane: vi.fn(() => document.createElement('div')),
	getContainer: vi.fn(() => document.createElement('div')),
	getBounds: vi.fn(() => ({
		getNorth: () => 47.7,
		getSouth: () => 47.5,
		getEast: () => -122.2,
		getWest: () => -122.4
	}))
};

export const mockLeafletMarker = {
	addTo: vi.fn(),
	setLatLng: vi.fn(),
	remove: vi.fn(),
	bindPopup: vi.fn(),
	openPopup: vi.fn(),
	closePopup: vi.fn(),
	on: vi.fn(),
	off: vi.fn(),
	getLatLng: vi.fn(() => ({ lat: 47.6062, lng: -122.3321 }))
};

export const mockLeafletTileLayer = {
	addTo: vi.fn(),
	remove: vi.fn(),
	setOpacity: vi.fn()
};

export const mockLeafletPolyline = {
	addTo: vi.fn(),
	remove: vi.fn(),
	setStyle: vi.fn(),
	getBounds: vi.fn(() => ({
		getNorth: () => 47.7,
		getSouth: () => 47.5,
		getEast: () => -122.2,
		getWest: () => -122.4
	}))
};

export const mockGoogleMap = {
	setCenter: vi.fn(),
	setZoom: vi.fn(),
	getZoom: vi.fn(() => 15),
	getCenter: vi.fn(() => ({ lat: () => 47.6062, lng: () => -122.3321 })),
	fitBounds: vi.fn(),
	addListener: vi.fn(),
	removeListener: vi.fn(),
	getDiv: vi.fn(() => document.createElement('div')),
	getBounds: vi.fn(() => ({
		getNorthEast: () => ({ lat: () => 47.7, lng: () => -122.2 }),
		getSouthWest: () => ({ lat: () => 47.5, lng: () => -122.4 })
	}))
};

export const mockGoogleMarker = {
	setPosition: vi.fn(),
	setMap: vi.fn(),
	addListener: vi.fn(),
	getPosition: vi.fn(() => ({ lat: () => 47.6062, lng: () => -122.3321 }))
};

// Mock Leaflet module
vi.mock('leaflet', () => ({
	map: vi.fn(() => mockLeafletMap),
	tileLayer: vi.fn(() => mockLeafletTileLayer),
	marker: vi.fn(() => mockLeafletMarker),
	polyline: vi.fn(() => mockLeafletPolyline),
	icon: vi.fn(() => ({})),
	divIcon: vi.fn(() => ({})),
	latLng: vi.fn((lat, lng) => ({ lat, lng })),
	latLngBounds: vi.fn(() => ({
		extend: vi.fn(),
		isValid: vi.fn(() => true)
	}))
}));

// Mock Google Maps module
vi.mock('$lib/googleMaps.js', () => ({
	loadGoogleMaps: vi.fn().mockResolvedValue({
		Map: vi.fn(() => mockGoogleMap),
		Marker: vi.fn(() => mockGoogleMarker),
		LatLng: vi.fn((lat, lng) => ({ lat: () => lat, lng: () => lng })),
		LatLngBounds: vi.fn(() => ({
			extend: vi.fn(),
			getNorthEast: vi.fn(),
			getSouthWest: vi.fn()
		}))
	})
}));

/**
 * Mock map provider for trip planning tests
 * Simulates the interface used by trip planning components
 */
export function createMockMapProvider() {
	const markers = new Map();
	const polylines = [];
	let markerIdCounter = 0;
	let polylineIdCounter = 0;

	return {
		// Map management
		map: mockLeafletMap,

		// Pin marker management for trip planning
		addPinMarker: vi.fn((location, label) => {
			const markerId = `pin_marker_${markerIdCounter++}`;
			const marker = {
				...mockLeafletMarker,
				id: markerId,
				location,
				label,
				type: 'pin'
			};
			markers.set(markerId, marker);
			return marker;
		}),

		removePinMarker: vi.fn((marker) => {
			if (marker && marker.id) {
				markers.delete(marker.id);
			}
		}),

		// Polyline management for route display
		createPolyline: vi.fn((points, style = {}, decode = false) => {
			const polylineId = `polyline_${polylineIdCounter++}`;
			const polyline = {
				...mockLeafletPolyline,
				id: polylineId,
				points,
				style,
				decoded: decode
			};
			polylines.push(polyline);
			return Promise.resolve(polyline);
		}),

		removePolyline: vi.fn((polyline) => {
			if (polyline && polyline.id) {
				const index = polylines.findIndex((p) => p.id === polyline.id);
				if (index !== -1) {
					polylines.splice(index, 1);
				}
			}
		}),

		// Stop marker management
		addStopRouteMarker: vi.fn((stop) => {
			const markerId = `stop_marker_${markerIdCounter++}`;
			const marker = {
				...mockLeafletMarker,
				id: markerId,
				stop,
				type: 'stop'
			};
			markers.set(markerId, marker);
			return marker;
		}),

		removeStopMarker: vi.fn((marker) => {
			if (marker && marker.id) {
				markers.delete(marker.id);
			}
		}),

		// Vehicle marker management
		addVehicleMarker: vi.fn((vehicle) => {
			const markerId = `vehicle_marker_${markerIdCounter++}`;
			const marker = {
				...mockLeafletMarker,
				id: markerId,
				vehicle,
				type: 'vehicle'
			};
			markers.set(markerId, marker);
			return marker;
		}),

		removeVehicleMarker: vi.fn((marker) => {
			if (marker && marker.id) {
				markers.delete(marker.id);
			}
		}),

		// Map view management
		setView: vi.fn((center, zoom) => {
			mockLeafletMap.setView(center, zoom);
		}),

		fitBounds: vi.fn((bounds) => {
			mockLeafletMap.fitBounds(bounds);
		}),

		// Event handling
		on: vi.fn((event, handler) => {
			mockLeafletMap.on(event, handler);
		}),

		off: vi.fn((event, handler) => {
			mockLeafletMap.off(event, handler);
		}),

		// Testing utilities
		_getMarkers: () => markers,
		_getPolylines: () => polylines,
		_clearMarkers: () => {
			markers.clear();
			markerIdCounter = 0;
		},
		_clearPolylines: () => {
			polylines.length = 0;
			polylineIdCounter = 0;
		},
		_reset: () => {
			markers.clear();
			polylines.length = 0;
			markerIdCounter = 0;
			polylineIdCounter = 0;
		}
	};
}

/**
 * Mock map provider with error scenarios for testing
 */
export function createErrorMapProvider() {
	return {
		addPinMarker: vi.fn(() => {
			throw new Error('Failed to add pin marker');
		}),

		removePinMarker: vi.fn(() => {
			throw new Error('Failed to remove pin marker');
		}),

		createPolyline: vi.fn(() => {
			return Promise.reject(new Error('Failed to create polyline'));
		}),

		removePolyline: vi.fn(() => {
			throw new Error('Failed to remove polyline');
		}),

		setView: vi.fn(() => {
			throw new Error('Failed to set map view');
		}),

		fitBounds: vi.fn(() => {
			throw new Error('Failed to fit bounds');
		})
	};
}
