import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { createMockMapProvider } from '../../../tests/mocks/mapProviders.js';

const fetchServicesForViewport = vi.hoisted(() => vi.fn());
vi.mock('$lib/onDemand/onDemandState.svelte.js', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, fetchServicesForViewport };
});
const pushState = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ pushState }));

import OnDemandZonesLayer from '../OnDemandZonesLayer.svelte';
import { onDemandState, resetOnDemandStateForTesting } from '$lib/onDemand/onDemandState.svelte.js';
import { parseServiceList } from '$lib/onDemand/models.js';
import { listBody, serviceJson } from '../../../tests/fixtures/onDemand.js';

const REGION = { north: 39.0, south: 38.6, east: -76.8, west: -77.4 }; // ~44 km tall
const STREET = { north: 38.83, south: 38.81, east: -77.05, west: -77.08 }; // ~2 km
const HIDDEN = { north: 40, south: 38, east: -76, west: -78 };
const flush = async () => {
	await tick();
	await Promise.resolve();
	await tick();
};

function setup(bounds = REGION, props = {}) {
	const provider = createMockMapProvider();
	provider.getBoundingBox = vi.fn(() => bounds);
	const view = render(OnDemandZonesLayer, {
		mapProvider: provider,
		active: true,
		viewportTick: 1,
		...props
	});
	return { provider, ...view };
}

describe('OnDemandZonesLayer', () => {
	beforeEach(() => {
		resetOnDemandStateForTesting();
		fetchServicesForViewport.mockReset();
		fetchServicesForViewport.mockResolvedValue(parseServiceList(listBody()));
		pushState.mockReset();
	});

	it('draws filled, clickable zones at region level', async () => {
		const { provider } = setup(REGION);
		await flush();
		expect(fetchServicesForViewport).toHaveBeenCalledWith(
			expect.objectContaining({ latSpan: expect.closeTo(0.4), lonSpan: expect.closeTo(0.6) })
		);
		const [, style] = provider.createPolygon.mock.calls[0];
		expect(style).toMatchObject({ fillOpacity: 0.2, interactive: true });
		style.onClick();
		expect(pushState).toHaveBeenCalledWith('/map/ondemand/5088_77652', {
			onDemandServiceId: '5088_77652'
		});
	});

	it('does not push history again when the open service zone is tapped', async () => {
		const { provider } = setup(REGION);
		await flush();
		const service = parseServiceList(listBody()).services.find(({ id }) => id === '5088_77652');
		onDemandState.highlighted = service;
		await flush();
		const [, style] = provider.createPolygon.mock.calls[0];
		style.onClick();
		expect(pushState).not.toHaveBeenCalled();
	});

	it('draws stroke-only, non-interactive zones at street level', async () => {
		const { provider } = setup(STREET);
		await flush();
		expect(provider.createPolygon.mock.calls[0][1]).toMatchObject({
			fillOpacity: 0,
			interactive: false,
			halo: { weight: 10 }
		});
	});

	it('neither fetches nor draws when zoomed out past the region level', async () => {
		const { provider } = setup(HIDDEN);
		await flush();
		expect(fetchServicesForViewport).not.toHaveBeenCalled();
		expect(provider.createPolygon).not.toHaveBeenCalled();
	});

	it('restyles instead of redrawing on a new tick with the same services', async () => {
		const { provider, rerender } = setup(REGION);
		await flush();
		await rerender({ viewportTick: 2 });
		await flush();
		expect(provider.createPolygon).toHaveBeenCalledTimes(1);
	});

	it('removes zones no longer returned', async () => {
		const { provider, rerender } = setup(REGION);
		await flush();
		fetchServicesForViewport.mockResolvedValue(parseServiceList(listBody([])));
		await rerender({ viewportTick: 2 });
		await flush();
		expect(provider.removePolygon).toHaveBeenCalled();
	});

	it('keeps the drawn zones when a viewport fetch fails transiently', async () => {
		const { provider, rerender } = setup(REGION);
		await flush();
		fetchServicesForViewport.mockResolvedValue(null);
		await rerender({ viewportTick: 2 });
		await flush();
		expect(provider.removePolygon).not.toHaveBeenCalled();
		expect(provider.polygons).toHaveLength(1);
	});

	it('still clears on zooming out past region level after a failed fetch', async () => {
		const { provider, rerender } = setup(REGION);
		await flush();
		fetchServicesForViewport.mockResolvedValue(null);
		await rerender({ viewportTick: 2 });
		await flush();
		provider.getBoundingBox.mockReturnValue(HIDDEN);
		await rerender({ viewportTick: 3 });
		await flush();
		expect(provider.removePolygon).toHaveBeenCalled();
	});

	it('clears when the map leaves normal mode or the server is unsupported', async () => {
		const { provider, rerender } = setup(REGION);
		await flush();
		await rerender({ active: false });
		await flush();
		expect(provider.removePolygon).toHaveBeenCalled();
		provider.removePolygon.mockClear();
		await rerender({ active: true, viewportTick: 3 });
		await flush();
		onDemandState.support = 'unsupported';
		await flush();
		expect(provider.removePolygon).toHaveBeenCalled();
	});

	it('discards a stale response that resolves after a newer one', async () => {
		let resolveFirst;
		fetchServicesForViewport
			.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
			.mockResolvedValueOnce(parseServiceList(listBody([serviceJson({ id: '5088_new' })])));
		const { provider, rerender } = setup(REGION);
		await rerender({ viewportTick: 2 });
		await flush();
		resolveFirst(parseServiceList(listBody([serviceJson({ id: '5088_old' })])));
		await flush();
		// Only the newer response is drawn; the stale one never reaches the map.
		expect(provider.createPolygon).toHaveBeenCalledTimes(1);
		expect(provider.removePolygon).not.toHaveBeenCalled();
		expect(provider.polygons).toHaveLength(1);
	});

	it('draws the highlighted service bolder and dims the rest', async () => {
		const { provider } = setup(REGION);
		await flush();
		const other = parseServiceList(listBody([serviceJson({ id: '5088_other', routeId: null })]))
			.services[0];
		onDemandState.highlighted = other;
		await flush();
		const styles = provider.setPolygonStyle.mock.calls.map(([, style]) => style);
		expect(styles.some((style) => style.opacity === 0.6)).toBe(true);
		const created = provider.createPolygon.mock.calls.map(([, style]) => style);
		expect(created.some((style) => style.weight === 4)).toBe(true);
	});
});
