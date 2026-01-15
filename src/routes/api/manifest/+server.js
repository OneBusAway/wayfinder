import { json } from '@sveltejs/kit';
import { truncateShortName } from '$lib/manifestUtils.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	const startUrl = url.searchParams.get('start') || '/';
	const name = url.searchParams.get('name') || process.env.PUBLIC_OBA_REGION_NAME || 'OneBusAway';
	const shortName = truncateShortName(name);
    const icon192 = process.env.MANIFEST_ICON_192_URL || '/android-chrome-192x192.png';
    const icon512 = process.env.MANIFEST_ICON_512_URL || '/android-chrome-512x512.png';

	const manifest = {
	name: name,
	short_name: shortName,
	start_url: startUrl,
	display: 'standalone',
	theme_color: '#ffffff',
	background_color: '#ffffff',
	icons: [
		{ src: icon192, sizes: '192x192', type: 'image/png' },
		{ src: icon512, sizes: '512x512', type: 'image/png' }
	]
};

	return json(manifest, {
		headers: {
			'Content-Type': 'application/manifest+json',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}
