export async function googleGeocode({ apiKey, query }) {
	const response = await fetch(
		`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
	);
	const data = await response.json();

	if (data.status === 'OK') {
		return data.results[0];
	} else {
		return null;
	}
}

export async function googlePlacesAutocomplete({ apiKey, input }) {
	const response = await fetch(`https://places.googleapis.com/v1/places:autocomplete`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Goog-Api-Key': apiKey
		},
		body: JSON.stringify({ input })
	});
	const data = await response.json();

	return data.suggestions;
}
