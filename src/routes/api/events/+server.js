import { env as dynamicEnv } from '$env/dynamic/public';
import { createAdapter } from '$lib/Analytics/createAdapter.js';

export async function POST({ request, getClientAddress }) {
	let envelope;
	try {
		envelope = await request.json();
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message || 'Invalid JSON' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const adapter = createAdapter(dynamicEnv);
		const ctx = {
			userAgent: request.headers.get('user-agent') ?? '',
			clientIp:
				(typeof getClientAddress === 'function' && getClientAddress()) ||
				request.headers.get('x-forwarded-for') ||
				''
		};
		const data = await adapter.forwardEvent(envelope, ctx);
		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		// AbortError comes from the adapter's AbortController timeout (5s) — surface as 504.
		const isTimeout = error?.name === 'AbortError';
		return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
			status: error.upstreamStatus || (isTimeout ? 504 : 500),
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
