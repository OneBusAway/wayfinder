/* eslint-disable no-restricted-syntax */
import onebusaway, { APIError, OnebusawaySDKError } from 'onebusaway-sdk';
import { PUBLIC_OBA_SERVER_URL as baseURL } from '$env/static/public';
import { PRIVATE_OBA_API_KEY as apiKey } from '$env/static/private';
import { error, isHttpError, json } from '@sveltejs/kit';

const oba = new onebusaway({
	baseURL,
	apiKey,
	// Some servers (e.g. MTA BusTime) default to the v1 response shape without this.
	defaultQuery: { version: 2 }
});

/**
 * Maps an upstream error status code to the appropriate HTTP status for Wayfinder.
 * - 404: Forward as 404 (Not Found).
 * - 400: Forward as 400 (Bad Request).
 * - 401, 403, 429: Map to 502 (Bad Gateway) to avoid exposing internal API key
 *   or rate-limit errors to riders, and to ensure proper 5xx server monitoring.
 * - 500..599: Map to 502 (Bad Gateway).
 * - Non-integer, fractional, or unrecognized codes: Map to 500 (Internal Server Error).
 *
 * @param {unknown} code
 * @returns {number}
 */
export function mapErrorStatus(code) {
	if (!Number.isInteger(code)) {
		return 500;
	}

	if (code === 404 || code === 400) {
		return code;
	}

	if (code === 401 || code === 403 || code === 429) {
		return 502;
	}

	if (code >= 500 && code <= 599) {
		return 502;
	}

	return 500;
}

/**
 * Executes an OBA SDK call, catches SDK errors, and normalizes error status codes.
 * - Missing entities throwing NotFoundError (status 404) or returning a null body are mapped to 404.
 * - Client errors (status 400) are forwarded as 400.
 * - Auth (401/403), rate-limits (429), connection failures, and 5xx errors are mapped to 502.
 *
 * @template T
 * @param {(() => Promise<T>) | Promise<T> | T} apiCall
 * @param {string} entityName
 * @returns {Promise<T>}
 */
export async function callOBA(apiCall, entityName) {
	try {
		const response = await (typeof apiCall === 'function' ? apiCall() : apiCall);

		// Upstream OBA returns HTTP 200 with an empty/null body when a resource
		// (such as a stop) is not found. Treat null/undefined response as 404.
		if (!response) {
			throw error(404, `Unable to fetch ${entityName}.`);
		}

		if (typeof response.code === 'undefined') {
			throw error(500, `Unable to fetch ${entityName}.`);
		}

		if (response.code !== 200) {
			const status = mapErrorStatus(response.code);
			throw error(status, `Unable to fetch ${entityName}.`);
		}

		return response;
	} catch (err) {
		if (isHttpError(err)) {
			throw err;
		}

		if (err instanceof APIError || (err && typeof err.status === 'number')) {
			const status = mapErrorStatus(err.status);
			throw error(status, `Unable to fetch ${entityName}.`);
		}

		if (err instanceof OnebusawaySDKError) {
			throw error(502, `Unable to fetch ${entityName}.`);
		}

		throw error(500, `Unable to fetch ${entityName}.`);
	}
}

/**
 * Synchronous validator and JSON response serializer for OBA responses.
 * Treats null/undefined as 404 and maps status codes via mapErrorStatus.
 *
 * @param {any} response
 * @param {string} entityName
 * @returns {Response}
 */
export function handleOBAResponse(response, entityName) {
	if (!response) {
		throw error(404, `Unable to fetch ${entityName}.`);
	}

	if (typeof response.code === 'undefined') {
		throw error(500, `Unable to fetch ${entityName}.`);
	}

	if (response.code !== 200) {
		const status = mapErrorStatus(response.code);
		throw error(status, `Unable to fetch ${entityName}.`);
	}

	return json(response);
}

export default oba;
