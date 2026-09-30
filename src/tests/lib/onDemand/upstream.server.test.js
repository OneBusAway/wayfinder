import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrivateEnv = vi.hoisted(() => ({ PRIVATE_OBA_AGENCY_FILTER: '' }));
vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockPrivateEnv;
	}
}));
vi.mock('$env/static/private', () => ({ PRIVATE_OBA_API_KEY: 'secret' }));

import {
	fetchOnDemand,
	loadServicesForLocation,
	loadServiceEntry,
	onDemandResponse
} from '$lib/onDemand/upstream.server.js';
import {
	isKnownUnsupported,
	isUnsupportedReply,
	recordProbeReply,
	resetOnDemandSupportForTesting,
	UNSUPPORTED_TTL_MS
} from '$lib/onDemand/serverSupport.server.js';

function reply(status, body, contentType = 'application/json') {
	const text = typeof body === 'string' ? body : JSON.stringify(body);
	return new Response(text, { status, headers: { 'content-type': contentType } });
}
const envelope = (data, code = 200) => ({ code, currentTime: 0, text: 'OK', version: 2, data });

describe('serverSupport', () => {
	beforeEach(() => resetOnDemandSupportForTesting());

	it('classifies a raw 404, a non-envelope 2xx and an envelope code 404 as unsupported', () => {
		expect(isUnsupportedReply({ status: 404, body: null, isEnvelope: false })).toBe(true);
		expect(isUnsupportedReply({ status: 200, body: null, isEnvelope: false })).toBe(true);
		expect(isUnsupportedReply({ status: 200, body: { code: 404 }, isEnvelope: true })).toBe(true);
		expect(isUnsupportedReply({ status: 200, body: { code: 200 }, isEnvelope: true })).toBe(false);
		expect(isUnsupportedReply({ status: 500, body: null, isEnvelope: false })).toBe(false);
	});

	it('remembers an unsupported verdict for one hour, then forgets it', () => {
		recordProbeReply({ status: 404, body: null, isEnvelope: false }, 1_000);
		expect(isKnownUnsupported(1_000 + UNSUPPORTED_TTL_MS - 1)).toBe(true);
		expect(isKnownUnsupported(1_000 + UNSUPPORTED_TTL_MS)).toBe(false);
	});

	it('clears the verdict when the server answers with an OK envelope', () => {
		recordProbeReply({ status: 404, body: null, isEnvelope: false }, 1_000);
		recordProbeReply({ status: 200, body: { code: 200 }, isEnvelope: true }, 2_000);
		expect(isKnownUnsupported(2_001)).toBe(false);
	});
});

describe('fetchOnDemand', () => {
	beforeEach(() => vi.restoreAllMocks());

	it('adds the key, drops empty params and flags envelopes', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(reply(200, envelope({ list: [] })));
		const result = await fetchOnDemand('services-for-location.json', {
			lat: 47.6,
			lon: -122.3,
			radius: null,
			geometryDetail: ''
		});
		const calledUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(calledUrl.pathname).toBe('/api/ondemand/services-for-location.json');
		expect(calledUrl.searchParams.get('key')).toBe('secret');
		expect(calledUrl.searchParams.get('lat')).toBe('47.6');
		expect(calledUrl.searchParams.has('radius')).toBe(false);
		expect(calledUrl.searchParams.has('geometryDetail')).toBe(false);
		expect(result).toMatchObject({ status: 200, isEnvelope: true });
	});

	it('treats an HTML body as a non-envelope', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, '<html></html>', 'text/html'));
		const result = await fetchOnDemand('services-for-location.json', {});
		expect(result).toEqual({ status: 200, body: null, isEnvelope: false });
	});
});

describe('loadServicesForLocation', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		resetOnDemandSupportForTesting();
		mockPrivateEnv.PRIVATE_OBA_AGENCY_FILTER = '';
	});

	it('returns the body on an OK envelope and records support', async () => {
		const body = envelope({ list: [{ id: '1_a', agencyId: '1' }], references: {} });
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, body));
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'ok', body });
		expect(isKnownUnsupported()).toBe(false);
	});

	it('marks the server unsupported on stock maglev HTML and stops calling upstream', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(reply(200, '<html></html>', 'text/html'));
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'unsupported' });
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'unsupported' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('is a transient error on 5xx and on network failure', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply(503, 'down', 'text/plain'));
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'error' });
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await loadServicesForLocation({ lat: 1, lon: 2 })).toEqual({ kind: 'error' });
		expect(isKnownUnsupported()).toBe(false);
	});

	it('removes services outside the agency filter', async () => {
		mockPrivateEnv.PRIVATE_OBA_AGENCY_FILTER = '1';
		const body = envelope({
			list: [
				{ id: '1_a', agencyId: '1' },
				{ id: '2_b', agencyId: '2' }
			],
			references: {}
		});
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, body));
		const result = await loadServicesForLocation({ lat: 1, lon: 2 });
		expect(result.body.data.list.map((s) => s.id)).toEqual(['1_a']);
	});
});

describe('loadServiceEntry', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		resetOnDemandSupportForTesting();
		mockPrivateEnv.PRIVATE_OBA_AGENCY_FILTER = '';
	});

	it('encodes the id and passes geometryDetail', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(reply(200, envelope({ entry: { id: '1_a b', agencyId: '1' } })));
		await loadServiceEntry('1_a b', 'simplified');
		const calledUrl = new URL(fetchMock.mock.calls[0][0]);
		expect(calledUrl.pathname).toBe('/api/ondemand/service/1_a%20b.json');
		expect(calledUrl.searchParams.get('geometryDetail')).toBe('simplified');
	});

	it('is not found on 404 without changing the support verdict', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(404, envelope(null, 404)));
		expect(await loadServiceEntry('1_x', null)).toEqual({ kind: 'notFound' });
		expect(isKnownUnsupported()).toBe(false);
	});

	it('is not found when the service belongs to a filtered-out agency', async () => {
		mockPrivateEnv.PRIVATE_OBA_AGENCY_FILTER = '1';
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			reply(200, envelope({ entry: { id: '2_b', agencyId: '2' } }))
		);
		expect(await loadServiceEntry('2_b', null)).toEqual({ kind: 'notFound' });
	});

	it('short-circuits to unsupported once the verdict is known', async () => {
		recordProbeReply({ status: 404, body: null, isEnvelope: false });
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		expect(await loadServiceEntry('1_a', null)).toEqual({ kind: 'unsupported' });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('onDemandResponse', () => {
	it.each([
		[{ kind: 'notFound' }, 404, { error: 'not_found' }],
		[{ kind: 'unsupported' }, 501, { error: 'ondemand_unsupported' }],
		[{ kind: 'error' }, 502, { error: 'upstream_error' }],
		[{ kind: 'ok', body: { code: 200 } }, 200, { code: 200 }]
	])('maps %j to %i', async (result, status, json) => {
		const response = onDemandResponse(result);
		expect(response.status).toBe(status);
		expect(await response.json()).toEqual(json);
	});
});
