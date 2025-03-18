/**
 * Loads the Google Maps JavaScript library.
 * @param {string} apiKey - The API key for accessing the Google Maps API.
 */
export function loadGoogleMapsLibrary(apiKey) {
	((g) => {
		var h,
			a,
			k,
			p = 'The Google Maps JavaScript API',
			c = 'google',
			l = 'importLibrary',
			q = '__ib__',
			m = document,
			b = window;
		b = b[c] || (b[c] = {});
		var d = b.maps || (b.maps = {}),
			r = new Set(),
			e = new URLSearchParams(),
			u = () =>
				h ||
				(h = new Promise(async (f, n) => {
					await (a = m.createElement('script'));
					e.set('libraries', [...r] + '');
					for (k in g)
						e.set(
							k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()),
							g[k]
						);
					e.set('callback', c + '.maps.' + q);
					a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
					d[q] = f;
					a.onerror = () => (h = n(Error(p + ' could not load.')));
					a.nonce = m.querySelector('script[nonce]')?.nonce || '';
					m.head.append(a);
				}));
		d[l]
			? console.warn(p + ' only loads once. Ignoring:', g)
			: (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
	})({
		key: apiKey,
		v: 'weekly'
	});
}

export async function createMap({ element, lat, lng, ...rest } = {}) {
	const { Map } = await window.google.maps.importLibrary('maps');

	let params = {
		center: { lat: parseFloat(lat), lng: parseFloat(lng) },
		zoom: 15,
		clickableIcons: false,
		disableDefaultUI: true,
		zoomControl: true,
		...rest
	};

	return new Map(element, params);
}

export function nightModeStyles() {
	return [
		{ elementType: 'geometry', stylers: [{ color: '#212121' }] },
		{ elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
		{ elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
		{
			featureType: 'administrative',
			elementType: 'geometry',
			stylers: [{ color: '#757575' }]
		},
		{
			featureType: 'administrative.country',
			elementType: 'labels.text.fill',
			stylers: [{ color: '#9e9e9e' }]
		},
		{
			featureType: 'administrative.locality',
			elementType: 'labels.text.fill',
			stylers: [{ color: '#bdbdbd' }]
		},
		{
			featureType: 'poi',
			elementType: 'labels.text.fill',
			stylers: [{ color: '#757575' }]
		},
		{
			featureType: 'poi.park',
			elementType: 'geometry',
			stylers: [{ color: '#181818' }]
		},
		{
			featureType: 'poi.park',
			elementType: 'labels.text.fill',
			stylers: [{ color: '#616161' }]
		},
		{
			featureType: 'poi.park',
			elementType: 'labels.text.stroke',
			stylers: [{ color: '#1b1b1b' }]
		},
		{
			featureType: 'road',
			elementType: 'geometry.fill',
			stylers: [{ color: '#2c2c2c' }]
		},
		{
			featureType: 'road',
			elementType: 'labels.text.fill',
			stylers: [{ color: '#8a8a8a' }]
		},
		{
			featureType: 'road.arterial',
			elementType: 'geometry',
			stylers: [{ color: '#373737' }]
		},
		{
			featureType: 'road.highway',
			elementType: 'geometry',
			stylers: [{ color: '#3c3c3c' }]
		},
		{
			featureType: 'road.highway.controlled_access',
			elementType: 'geometry',
			stylers: [{ color: '#4e4e4e' }]
		},
		{
			featureType: 'road.local',
			elementType: 'labels.text.fill',
			stylers: [{ color: '#616161' }]
		},
		{
			featureType: 'transit',
			elementType: 'labels.text.fill',
			stylers: [{ color: '#757575' }]
		},
		{
			featureType: 'water',
			elementType: 'geometry',
			stylers: [{ color: '#000000' }]
		},
		{
			featureType: 'water',
			elementType: 'labels.text.fill',
			stylers: [{ color: '#3d3d3d' }]
		}
	];
}
