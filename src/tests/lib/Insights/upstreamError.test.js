import { describe, it, expect } from 'vitest';
import { insightsError, upstreamError } from '$lib/Insights/upstreamError.js';

const response = (overrides) => ({
	status: 400,
	statusText: 'Bad Request',
	text: async () => '',
	...overrides
});

describe('insightsError', () => {
	it('carries the message and upstreamStatus', () => {
		const error = insightsError('dropped as bot-like', 502);
		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe('dropped as bot-like');
		expect(error.upstreamStatus).toBe(502);
	});
});

describe('upstreamError', () => {
	it('folds the response body into the message', async () => {
		const error = await upstreamError(
			response({
				text: async () => '{"error":{"message":"Website not found.","code":"bad-request"}}'
			})
		);
		expect(error.message).toBe(
			'Error sending event: 400 Bad Request — {"error":{"message":"Website not found.","code":"bad-request"}}'
		);
	});

	it('sets upstreamStatus from the response status', async () => {
		const error = await upstreamError(response({ status: 503, statusText: 'Service Unavailable' }));
		expect(error.upstreamStatus).toBe(503);
	});

	// HTTP/2 has no reason phrase, so statusText is '' for every h2 response — including the
	// one the browser gets back from /api/events in production.
	it('falls back to the numeric status when statusText is empty (HTTP/2)', async () => {
		const error = await upstreamError(
			response({ statusText: '', text: async () => 'Website not found.' })
		);
		expect(error.message).toBe('Error sending event: 400 — Website not found.');
	});

	it('omits the separator when the body is empty', async () => {
		const error = await upstreamError(response({ text: async () => '' }));
		expect(error.message).toBe('Error sending event: 400 Bad Request');
	});

	it('omits the separator when the body is only whitespace', async () => {
		const error = await upstreamError(response({ text: async () => '  \n\t ' }));
		expect(error.message).toBe('Error sending event: 400 Bad Request');
	});

	it('truncates an oversized body', async () => {
		const error = await upstreamError(response({ text: async () => 'x'.repeat(500) }));
		expect(error.message).toBe(`Error sending event: 400 Bad Request — ${'x'.repeat(300)}…`);
	});

	it('leaves a body at exactly the limit untruncated', async () => {
		const error = await upstreamError(response({ text: async () => 'x'.repeat(300) }));
		expect(error.message).toBe(`Error sending event: 400 Bad Request — ${'x'.repeat(300)}`);
	});

	// An unreadable body and an empty body are different incidents; the message must not
	// conflate them, and neither may mask the upstream status.
	it('reports an unreadable body without losing the status', async () => {
		const error = await upstreamError(
			response({
				text: async () => {
					throw new TypeError('stream already consumed');
				}
			})
		);
		expect(error.message).toBe(
			'Error sending event: 400 Bad Request — <upstream body unreadable: TypeError>'
		);
		expect(error.upstreamStatus).toBe(400);
	});

	it('reports an unreadable body when the response exposes no text()', async () => {
		const error = await upstreamError({ status: 400, statusText: 'Bad Request' });
		expect(error.message).toBe(
			'Error sending event: 400 Bad Request — <upstream body unreadable: TypeError>'
		);
		expect(error.upstreamStatus).toBe(400);
	});
});
