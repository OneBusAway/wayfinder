import { describe, expect, test } from 'vitest';
import { resolveCustomBasemap, vectorTileSource } from '$lib/arcgisBasemap';

const ID = 'e19f33d2c1f44967aef673306c483913';
const PORTAL = 'https://gis.example.test/portal';

describe('vectorTileSource', () => {
	test.each([undefined, null, '', '   '])('treats %j as unconfigured', (value) => {
		expect(vectorTileSource(value)).toBeNull();
	});

	test.each([
		`${PORTAL}/home/item.html?id=${ID}`,
		`${PORTAL}/home/item.html?id=${ID}#overview`,
		`${PORTAL}/sharing/rest/content/items/${ID}`,
		`${PORTAL}/sharing/rest/content/items/${ID}/?f=json`
	])('reads %s as a portal item', (url) => {
		expect(vectorTileSource(url)).toEqual({ portalItem: { id: ID, portal: { url: PORTAL } } });
	});

	test('reads an ArcGIS Online item page as a portal item', () => {
		expect(vectorTileSource(`https://www.arcgis.com/home/item.html?id=${ID}`)).toEqual({
			portalItem: { id: ID, portal: { url: 'https://www.arcgis.com' } }
		});
	});

	test.each([
		'https://gis.example.test/server/rest/services/Hosted/Campus/VectorTileServer',
		`${PORTAL}/sharing/rest/content/items/${ID}/resources/styles/root.json`,
		`${PORTAL}/home/item.html?id=not-an-item-id`,
		'not a url'
	])('passes %s through as a layer URL', (url) => {
		expect(vectorTileSource(url)).toEqual({ url });
	});

	test('trims surrounding whitespace', () => {
		expect(vectorTileSource('  https://tiles.example.test/style.json ')).toEqual({
			url: 'https://tiles.example.test/style.json'
		});
	});
});

describe('resolveCustomBasemap', () => {
	test('returns null without a light URL, even when dark URL and mode are set', () => {
		expect(resolveCustomBasemap(undefined)).toBeNull();
		expect(resolveCustomBasemap('')).toBeNull();
		expect(
			resolveCustomBasemap({
				url: '',
				darkUrl: 'https://tiles.example.test/dark.json',
				mode: 'overlay'
			})
		).toBeNull();
	});

	test('reads a bare string as a replacement basemap with no dark variant', () => {
		expect(resolveCustomBasemap('https://tiles.example.test/style.json')).toEqual({
			light: { url: 'https://tiles.example.test/style.json' },
			dark: null,
			overlay: false
		});
	});

	test('resolves light and dark sources and overlay mode', () => {
		expect(
			resolveCustomBasemap({
				url: `${PORTAL}/home/item.html?id=${ID}`,
				darkUrl: 'https://tiles.example.test/dark.json',
				mode: ' Overlay '
			})
		).toEqual({
			light: { portalItem: { id: ID, portal: { url: PORTAL } } },
			dark: { url: 'https://tiles.example.test/dark.json' },
			overlay: true
		});
	});

	test.each([undefined, null, '', 'replace', 'unknown'])('mode %j replaces the basemap', (mode) => {
		expect(resolveCustomBasemap({ url: 'https://tiles.example.test/a.json', mode })?.overlay).toBe(
			false
		);
	});
});
