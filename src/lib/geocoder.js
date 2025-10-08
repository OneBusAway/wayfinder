import { calculateRadiusFromBounds } from './mathUtils.js';

export async function googleGeocode({ apiKey, query, bounds = null }) {
	let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

	if (bounds) {
		url += `&bounds=${bounds.south},${bounds.west}|${bounds.north},${bounds.east}`;
	}
	const response = await fetch(url);
	const data = await response.json();

	if (data.status !== 'OK' || data.results.length === 0) {
		return null;
	}

	const result = data.results[0];

	return createGeocodingResult({
		geometry: result.geometry,
		formatted_address: result.formatted_address,
		name: result.formatted_address
	});
}

export async function googlePlacesAutocomplete({ apiKey, input, bounds = null }) {
	const requestBody = { input };

	if (bounds) {
		const centerLat = (bounds.north + bounds.south) / 2;
		const centerLng = (bounds.east + bounds.west) / 2;

		let radius = calculateRadiusFromBounds(bounds);

		// Google Places API has a maximum radius of 50,000 meters
		const MAX_RADIUS = 50000;
		if (radius > MAX_RADIUS) {
			console.log(`Calculated radius ${radius}m exceeds maximum, capping at ${MAX_RADIUS}m`);
			radius = MAX_RADIUS;
		}

		requestBody.locationBias = {
			circle: {
				center: {
					latitude: centerLat,
					longitude: centerLng
				},
				radius: radius
			}
		};
	}

	const response = await fetch(`https://places.googleapis.com/v1/places:autocomplete`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Goog-Api-Key': apiKey
		},
		body: JSON.stringify(requestBody)
	});
	const data = await response.json();

	if (!data.suggestions) {
		return [];
	}

	const suggestions = [];
	for (const suggestion of data.suggestions) {
		const prediction = suggestion.placePrediction;

		const suggestionObject = createSuggestion(
			prediction.placeId,
			prediction.text.text,
			prediction.text.text
		);

		if (suggestionObject) {
			suggestions.push(suggestionObject);
		}
	}

	return suggestions;
}

export async function bingGeocode({ apiKey, query, bounds = null }) {
	let url = `https://dev.virtualearth.net/REST/v1/Locations?query=${encodeURIComponent(query)}&key=${apiKey}`;

	if (bounds) {
		const centerLat = (bounds.north + bounds.south) / 2;
		const centerLon = (bounds.east + bounds.west) / 2;
		url += `&userLocation=${centerLat},${centerLon}`;
	}

	const response = await fetch(url);
	const data = await response.json();

	if (
		data.statusCode !== 200 ||
		!data.resourceSets ||
		data.resourceSets.length === 0 ||
		!data.resourceSets[0].resources ||
		data.resourceSets[0].resources.length === 0
	) {
		return null;
	}

	const result = data.resourceSets[0].resources[0];
	const coordinates = result.point.coordinates;

	return createGeocodingResult({
		geometry: {
			location: {
				lat: coordinates[0],
				lng: coordinates[1]
			}
		},
		formatted_address: result.name,
		name: result.name
	});
}

export async function bingAutoSuggestPlaces({ apiKey, query, bounds = null }) {
	let url = `https://dev.virtualearth.net/REST/v1/Autosuggest?query=${encodeURIComponent(query)}&key=${apiKey}`;

	if (bounds) {
		const centerLat = (bounds.north + bounds.south) / 2;
		const centerLng = (bounds.east + bounds.west) / 2;
		url += `&userLocation=${centerLat},${centerLng}`;
	}

	const rawBingResult = await fetch(url, {
		method: 'GET',
		headers: { Accept: 'application/json' }
	});

	const data = await rawBingResult.json();

	const resourceSets = data.resourceSets;

	if (!resourceSets || resourceSets.length === 0 || resourceSets[0].estimatedTotal === 0) {
		return [];
	}

	const resources = resourceSets[0].resources;
	if (!resources || resources.length === 0) {
		return [];
	}

	const suggestions = [];
	for (const resource of resources) {
		if (resource.value && Array.isArray(resource.value)) {
			for (const item of resource.value) {
				const displayText = item.name
					? `${item.name} - ${item.address.formattedAddress}`
					: item.address.formattedAddress;

				const suggestion = createSuggestion(
					null,
					item.name || item.address.formattedAddress,
					displayText
				);

				if (suggestion) {
					suggestions.push(suggestion);
				}
			}
		} else {
			const suggestion = createSuggestion(
				null,
				resource.name || resource.address.formattedAddress,
				resource.address.formattedAddress
			);

			if (suggestion) {
				suggestions.push(suggestion);
			}
		}
	}

	return suggestions;
}

export async function fetchAutocompleteResults(provider, query, apiKey, bounds = null) {
	switch (provider) {
		case 'google':
			return await googlePlacesAutocomplete({ apiKey, input: query, bounds });
		case 'bing':
			return await bingAutoSuggestPlaces({ apiKey, query, bounds });
		default:
			throw new Error('Invalid geocoding provider');
	}
}

/**
 *
 * @param {string} placeId     optional - some providers return a placeId
 * @param {string} name    	   required - used for geocoding the selected place
 * @param {string} displayText required - used for displaying the selected place
 * @returns
 */
function createSuggestion(placeId, name, displayText) {
	if (!name || !displayText) return null;

	return {
		...(placeId && { placeId }),
		name,
		displayText
	};
}

/**
 *
 * @param {location{lat,lng}} geometry
 * @param {string} formatted_address
 * @param {string} name
 * @returns
 */
function createGeocodingResult({ geometry, formatted_address, name }) {
	return {
		name: name || formatted_address,
		formatted_address: formatted_address,
		geometry: {
			location: {
				lat: geometry.location.lat,
				lng: geometry.location.lng
			}
		}
	};
}
