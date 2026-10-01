import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	onDemandState,
	fetchServicesForViewport,
	fetchService,
	seedService,
	setHighlightedService,
	resetOnDemandStateForTesting,
	CACHE_TTL_MS,
	MAX_CACHE_ENTRIES
} from '$lib/onDemand/onDemandState.svelte.js';
import { entryBody, listBody } from '../../fixtures/onDemand.js';

const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
const status = (code) => new Response(JSON.stringify({ error: 'x' }), { status: code });
const viewport = { lat: 38.8, lon: -77.1, latSpan: 0.2, lonSpan: 0.3 };

describe('onDemandState', () => {
	beforeEach(() => {
		resetOnDemandStateForTesting();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('requests simplified geometry for the viewport and records support', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok(listBody()));
		const result = await fetchServicesForViewport(viewport);
		expect(result.services).toHaveLength(1);
		const url = new URL(fetchMock.mock.calls[0][0], 'http://x');
		expect(url.pathname).toBe('/api/oba/ondemand/services-for-location');
		expect(url.searchParams.get('geometryDetail')).toBe('simplified');
		expect(onDemandState.support).toBe('supported');
	});

	it('caches viewports rounded to two decimals for ten minutes', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok(listBody()));
		await fetchServicesForViewport(viewport);
		await fetchServicesForViewport({ ...viewport, lat: 38.801 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(CACHE_TTL_MS + 1);
		await fetchServicesForViewport(viewport);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('evicts expired viewports and caps the cache on write', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok(listBody()));
		const pan = (step) => fetchServicesForViewport({ ...viewport, lat: 10 + step });
		for (let step = 0; step < MAX_CACHE_ENTRIES + 5; step++) await pan(step);
		expect(fetchMock).toHaveBeenCalledTimes(MAX_CACHE_ENTRIES + 5);

		await pan(MAX_CACHE_ENTRIES + 4); // newest survives the cap
		expect(fetchMock).toHaveBeenCalledTimes(MAX_CACHE_ENTRIES + 5);
		await pan(0); // oldest was dropped
		expect(fetchMock).toHaveBeenCalledTimes(MAX_CACHE_ENTRIES + 6);

		vi.advanceTimersByTime(CACHE_TTL_MS + 1);
		await pan(100); // the write sweeps everything expired
		fetchMock.mockClear();
		await pan(MAX_CACHE_ENTRIES + 4);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('shares one in-flight request between identical callers', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok(entryBody()));
		await Promise.all([fetchService('5088_77652', 'none'), fetchService('5088_77652', 'none')]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('goes unsupported on a 501 and stops fetching', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(status(501));
		expect(await fetchServicesForViewport(viewport)).toBeNull();
		expect(onDemandState.support).toBe('unsupported');
		expect(await fetchService('5088_77652', 'none')).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('reports not-found and failures distinctly', async () => {
		vi.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(status(404))
			.mockResolvedValueOnce(status(502));
		expect(await fetchService('a', 'none')).toEqual({ notFound: true });
		expect(await fetchService('b', 'none')).toBeNull();
		expect(onDemandState.support).toBe('unknown');
	});

	it('lets a simplified entry satisfy a none request, but not the reverse', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ok(entryBody()));
		seedService('5088_77652', 'simplified', entryBody());
		await fetchService('5088_77652', 'none');
		expect(fetchMock).not.toHaveBeenCalled();
		seedService('x', 'none', entryBody());
		await fetchService('x', 'simplified');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('stores the highlighted service as-is, without a deep proxy', () => {
		const service = { id: '5088_77652', areas: [{ geometry: { coordinates: [[[0, 0]]] } }] };
		setHighlightedService(service);
		expect(onDemandState.highlighted).toBe(service);
		expect(onDemandState.highlighted.areas[0]).toBe(service.areas[0]);
	});
});
