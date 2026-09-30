export function buildURL(
	baseURL: string,
	path: string,
	params: ConstructorParameters<typeof URLSearchParams>[0]
) {
	const cleanBase = baseURL.replace(/\/+$/, '');
	const cleanPath = path.replace(/^\/+/, '');
	const url = [cleanBase, cleanPath].join('/');
	const query = new URLSearchParams(params);

	return `${url}?${query.toString()}`;
}

/**
 * Path for an on-demand service opened on the map; shareable and pushed onto
 * history when a zone or a stop-card row is tapped.
 * @param {string} id - combined service id (e.g. "5088_77652")
 * @returns {string}
 */
export function onDemandServicePath(id) {
	return `/map/ondemand/${encodeURIComponent(id)}`;
}
