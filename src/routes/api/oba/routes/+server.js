import { json } from '@sveltejs/kit';
import { getRoutesCache, getCacheState } from '$lib/serverCache.js';

export async function GET() {
	const cacheState = getCacheState();
	const cachedRoutes = getRoutesCache();

	if (cachedRoutes) {
		return json({ routes: cachedRoutes });
	} else if (cacheState === 'loading') {
		return json({ error: 'Routes data is loading, please retry' }, { status: 503 });
	} else {
		return json({ error: 'Routes data not available' }, { status: 500 });
	}
}
