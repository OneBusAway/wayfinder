import { PlausibleAnalytics } from '$lib/Analytics/PlausibleAnalytics.js';

// Singleton: env values are read dynamically on each call via SvelteKit's env proxy
const analytics = new PlausibleAnalytics();

export async function POST({ request }) {
	try {
		const event = await request.json();
		const data = await analytics.forwardEvent(event);
		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
			status: error.upstreamStatus || 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
