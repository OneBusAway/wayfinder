import { json } from '@sveltejs/kit';
import { getRoutesCache } from '$src/hooks.server';

export async function GET() {
	const cachedRoutes = getRoutesCache();
	if (cachedRoutes) {
		return json({ routes: cachedRoutes });
	} else {
		return json({ error: 'Routes data not available' }, { status: 500 });
	}
}
