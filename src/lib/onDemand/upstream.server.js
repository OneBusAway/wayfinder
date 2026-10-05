import { json } from '@sveltejs/kit';
import { PUBLIC_OBA_SERVER_URL } from '$env/static/public';
import { PRIVATE_OBA_API_KEY } from '$env/static/private';
import { buildURL } from '$lib/urls';
import { getAgencyFilter } from '$lib/agencyFilter.js';
import {
	isKnownUnsupported,
	isSuccessWithoutEnvelope,
	isUnsupportedReply,
	recordProbeReply
} from '$lib/onDemand/serverSupport.server.js';

/**
 * @typedef {{ status: number, body: any, isEnvelope: boolean }} UpstreamReply
 * @typedef {{ kind: 'ok', body: any } | { kind: 'notFound' } | { kind: 'unsupported' } | { kind: 'error' }} OnDemandResult
 */

/**
 * GET a maglev `/api/ondemand/{path}`. Throws only on network failure.
 * @param {string} path - e.g. "services-for-location.json"
 * @param {Record<string, string | number | null | undefined>} params
 * @returns {Promise<UpstreamReply>}
 */
export async function fetchOnDemand(path, params) {
	const query = { key: PRIVATE_OBA_API_KEY };
	for (const [name, value] of Object.entries(params)) {
		if (value != null && value !== '') query[name] = String(value);
	}
	const response = await fetch(buildURL(PUBLIC_OBA_SERVER_URL, `api/ondemand/${path}`, query));
	const body = parseJson(await response.text());
	const isEnvelope = body !== null && typeof body === 'object' && typeof body.code === 'number';
	return { status: response.status, body: isEnvelope ? body : null, isEnvelope };
}

function parseJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * @param {Record<string, string | number | null | undefined>} params - validated query
 * @returns {Promise<OnDemandResult>}
 */
export async function loadServicesForLocation(params) {
	if (isKnownUnsupported()) return { kind: 'unsupported' };
	const reply = await fetchOrNull('services-for-location.json', params);
	if (!reply) return { kind: 'error' };
	recordProbeReply(reply);
	if (isUnsupportedReply(reply)) return { kind: 'unsupported' };
	if (!isOkEnvelope(reply)) return { kind: 'error' };
	return { kind: 'ok', body: withoutFilteredServices(reply.body) };
}

/**
 * @param {string} id - combined service id
 * @param {string | null} geometryDetail
 * @returns {Promise<OnDemandResult>}
 */
export async function loadServiceEntry(id, geometryDetail) {
	if (isKnownUnsupported()) return { kind: 'unsupported' };
	const reply = await fetchOrNull(`service/${encodeURIComponent(id)}.json`, { geometryDetail });
	if (!reply) return { kind: 'error' };
	const isNotFound = reply.status === 404 || (reply.isEnvelope && reply.body.code === 404);
	if (isNotFound) return { kind: 'notFound' };
	// A 404 here is an ordinary not-found, so only a 2xx non-envelope reply (stock maglev's
	// HTML single-page app) counts as a probe.
	if (isSuccessWithoutEnvelope(reply)) {
		recordProbeReply(reply);
		return { kind: 'unsupported' };
	}
	if (!isOkEnvelope(reply)) return { kind: 'error' };
	const agencyIds = getAgencyFilter();
	if (agencyIds && !agencyIds.has(reply.body.data?.entry?.agencyId)) return { kind: 'notFound' };
	return { kind: 'ok', body: reply.body };
}

/**
 * @param {OnDemandResult} result
 * @returns {Response}
 */
export function onDemandResponse(result) {
	switch (result.kind) {
		case 'ok':
			return json(result.body);
		case 'notFound':
			return json({ error: 'not_found' }, { status: 404 });
		case 'unsupported':
			return json({ error: 'ondemand_unsupported' }, { status: 501 });
		default:
			return json({ error: 'upstream_error' }, { status: 502 });
	}
}

async function fetchOrNull(path, params) {
	try {
		return await fetchOnDemand(path, params);
	} catch (error) {
		console.error(`ondemand ${path} request failed:`, error);
		return null;
	}
}

function isOkEnvelope(reply) {
	return reply.isEnvelope && reply.body.code === 200;
}

function withoutFilteredServices(body) {
	const agencyIds = getAgencyFilter();
	if (!agencyIds || !Array.isArray(body.data?.list)) return body;
	const list = body.data.list.filter((service) => agencyIds.has(service.agencyId));
	return { ...body, data: { ...body.data, list } };
}
