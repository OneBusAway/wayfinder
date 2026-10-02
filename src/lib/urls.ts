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
