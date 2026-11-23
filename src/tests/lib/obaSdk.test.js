/* eslint-disable no-restricted-syntax */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import onebusaway from 'onebusaway-sdk';
import { handleOBAResponse, callOBA, mapErrorStatus } from '$lib/obaSdk';
import { error, json } from '@sveltejs/kit';

const {
	MockOnebusawaySDKError,
	MockAPIError,
	MockNotFoundError,
	MockAPIConnectionError,
	MockAPIConnectionTimeoutError,
	HTTP_ERROR_SYMBOL
} = vi.hoisted(() => {
	class MockOnebusawaySDKError extends Error {
		constructor(message) {
			super(message);
			this.name = 'OnebusawaySDKError';
		}
	}
	class MockAPIError extends MockOnebusawaySDKError {
		constructor(status, errorData, message) {
			super(message || `${status}`);
			this.name = 'APIError';
			this.status = status;
		}
	}
	class MockNotFoundError extends MockAPIError {
		constructor(status = 404, errorData, message) {
			super(status, errorData, message || 'Not found');
			this.name = 'NotFoundError';
		}
	}
	class MockAPIConnectionError extends MockAPIError {
		constructor(message) {
			super(undefined, undefined, message || 'Connection error');
			this.name = 'APIConnectionError';
			this.status = undefined;
		}
	}
	class MockAPIConnectionTimeoutError extends MockAPIConnectionError {
		constructor(message) {
			super(message || 'Connection timeout');
			this.name = 'APIConnectionTimeoutError';
		}
	}
	return {
		MockOnebusawaySDKError,
		MockAPIError,
		MockNotFoundError,
		MockAPIConnectionError,
		MockAPIConnectionTimeoutError,
		HTTP_ERROR_SYMBOL: Symbol('sveltekit.http-error')
	};
});

// Mock onebusaway-sdk
vi.mock('onebusaway-sdk', () => {
	const MockOneBusAway = vi.fn();
	MockOneBusAway.OnebusawaySDKError = MockOnebusawaySDKError;
	MockOneBusAway.APIError = MockAPIError;
	MockOneBusAway.NotFoundError = MockNotFoundError;
	MockOneBusAway.APIConnectionError = MockAPIConnectionError;
	MockOneBusAway.APIConnectionTimeoutError = MockAPIConnectionTimeoutError;
	return {
		default: MockOneBusAway,
		OnebusawaySDKError: MockOnebusawaySDKError,
		APIError: MockAPIError,
		NotFoundError: MockNotFoundError,
		APIConnectionError: MockAPIConnectionError,
		APIConnectionTimeoutError: MockAPIConnectionTimeoutError
	};
});

// Mock @sveltejs/kit error, isHttpError, and json functions
vi.mock('@sveltejs/kit', () => ({
	isHttpError: vi.fn((err) => Boolean(err && err[HTTP_ERROR_SYMBOL])),
	error: vi.fn((status, message) => {
		const err = new Error(message);
		err.status = status;
		err[HTTP_ERROR_SYMBOL] = true;
		throw err;
	}),
	json: vi.fn((data) => ({
		status: 200,
		body: data
	}))
}));

// Mock environment variables
vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_SERVER_URL: 'https://test-api.example.com'
}));

vi.mock('$env/static/private', () => ({
	PRIVATE_OBA_API_KEY: 'test-api-key'
}));

// Captured before beforeEach's clearAllMocks wipes the module-load call.
const moduleConstructorArgs = vi.mocked(onebusaway).mock.calls[0]?.[0];

describe('OneBusAway Client', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('OBA Client Initialization', () => {
		it('should initialize with correct configuration', () => {
			expect(moduleConstructorArgs).toEqual({
				baseURL: 'https://test-api.example.com',
				apiKey: 'test-api-key',
				defaultQuery: { version: 2 }
			});
		});
	});

	describe('mapErrorStatus', () => {
		it('forwards 404 and 400 as-is', () => {
			expect(mapErrorStatus(404)).toBe(404);
			expect(mapErrorStatus(400)).toBe(400);
		});

		it('maps upstream auth and rate-limit codes (401, 403, 429) to 502 Bad Gateway', () => {
			expect(mapErrorStatus(401)).toBe(502);
			expect(mapErrorStatus(403)).toBe(502);
			expect(mapErrorStatus(429)).toBe(502);
		});

		it('maps 5xx server errors to 502 Bad Gateway', () => {
			expect(mapErrorStatus(500)).toBe(502);
			expect(mapErrorStatus(502)).toBe(502);
			expect(mapErrorStatus(503)).toBe(502);
			expect(mapErrorStatus(504)).toBe(502);
			expect(mapErrorStatus(599)).toBe(502);
		});

		it('falls back to 500 for invalid, fractional, or unrecognized status codes', () => {
			expect(mapErrorStatus(404.5)).toBe(500);
			expect(mapErrorStatus('404')).toBe(500);
			expect(mapErrorStatus(null)).toBe(500);
			expect(mapErrorStatus(undefined)).toBe(500);
			expect(mapErrorStatus(NaN)).toBe(500);
			expect(mapErrorStatus(999)).toBe(500);
			expect(mapErrorStatus(301)).toBe(500);
		});
	});

	describe('callOBA', () => {
		it('returns response when call resolves with 200', async () => {
			const mockData = { code: 200, data: { entry: { id: '1_100' } } };
			const result = await callOBA(() => Promise.resolve(mockData), 'stop');
			expect(result).toEqual(mockData);
		});

		it('supports direct promises in addition to functions', async () => {
			const mockData = { code: 200, data: { entry: { id: '1_100' } } };
			const result = await callOBA(Promise.resolve(mockData), 'stop');
			expect(result).toEqual(mockData);
		});

		it('treats null or undefined response as 404 (Puget Sound empty stop response)', async () => {
			await expect(callOBA(() => Promise.resolve(null), 'stop')).rejects.toMatchObject({
				status: 404,
				message: 'Unable to fetch stop.'
			});
			await expect(callOBA(() => Promise.resolve(undefined), 'stop')).rejects.toMatchObject({
				status: 404,
				message: 'Unable to fetch stop.'
			});
		});

		it('throws 404 when response payload has code 404', async () => {
			const mockData = { code: 404, data: null };
			await expect(callOBA(() => Promise.resolve(mockData), 'stop')).rejects.toMatchObject({
				status: 404,
				message: 'Unable to fetch stop.'
			});
		});

		it('throws 400 when response payload has code 400', async () => {
			const mockData = { code: 400, data: null };
			await expect(callOBA(() => Promise.resolve(mockData), 'stop')).rejects.toMatchObject({
				status: 400,
				message: 'Unable to fetch stop.'
			});
		});

		it('maps response code 401, 403, 429, or 500 to 502', async () => {
			await expect(
				callOBA(() => Promise.resolve({ code: 401, data: null }), 'stop')
			).rejects.toMatchObject({ status: 502 });
			await expect(
				callOBA(() => Promise.resolve({ code: 403, data: null }), 'stop')
			).rejects.toMatchObject({ status: 502 });
			await expect(
				callOBA(() => Promise.resolve({ code: 429, data: null }), 'stop')
			).rejects.toMatchObject({ status: 502 });
			await expect(
				callOBA(() => Promise.resolve({ code: 500, data: null }), 'stop')
			).rejects.toMatchObject({ status: 502 });
		});

		it('catches SDK NotFoundError (status 404) and maps to 404', async () => {
			const notFoundErr = new MockNotFoundError(404, {}, 'Not found', {});
			await expect(callOBA(() => Promise.reject(notFoundErr), 'trip')).rejects.toMatchObject({
				status: 404,
				message: 'Unable to fetch trip.'
			});
		});

		it('catches SDK APIError with status 400 and maps to 400', async () => {
			const badReqErr = new MockAPIError(400, {}, 'Bad request', {});
			await expect(callOBA(() => Promise.reject(badReqErr), 'trip')).rejects.toMatchObject({
				status: 400,
				message: 'Unable to fetch trip.'
			});
		});

		it('catches SDK APIError with status 401/403/429 and maps to 502', async () => {
			const authErr = new MockAPIError(401, {}, 'Unauthorized', {});
			await expect(callOBA(() => Promise.reject(authErr), 'trip')).rejects.toMatchObject({
				status: 502,
				message: 'Unable to fetch trip.'
			});

			const rateLimitErr = new MockAPIError(429, {}, 'Too many requests', {});
			await expect(callOBA(() => Promise.reject(rateLimitErr), 'trip')).rejects.toMatchObject({
				status: 502,
				message: 'Unable to fetch trip.'
			});
		});

		it('catches APIConnectionError and APIConnectionTimeoutError and maps to 502', async () => {
			const connErr = new MockAPIConnectionError('Connection refused');
			await expect(callOBA(() => Promise.reject(connErr), 'trip')).rejects.toMatchObject({
				status: 502,
				message: 'Unable to fetch trip.'
			});

			const timeoutErr = new MockAPIConnectionTimeoutError('Connection timeout');
			await expect(callOBA(() => Promise.reject(timeoutErr), 'trip')).rejects.toMatchObject({
				status: 502,
				message: 'Unable to fetch trip.'
			});
		});

		it('catches OnebusawaySDKError (connection errors) and maps to 502', async () => {
			const connErr = new MockOnebusawaySDKError('Connection timeout');
			await expect(callOBA(() => Promise.reject(connErr), 'trip')).rejects.toMatchObject({
				status: 502,
				message: 'Unable to fetch trip.'
			});
		});

		it('catches generic errors and falls back to 500', async () => {
			await expect(
				callOBA(() => Promise.reject(new Error('Unexpected JS error')), 'stop')
			).rejects.toMatchObject({ status: 500 });
		});
	});

	describe('handleOBAResponse', () => {
		it('should return JSON response when status code is 200', () => {
			const mockResponse = {
				code: 200,
				data: {
					stops: []
				}
			};

			const result = handleOBAResponse(mockResponse, 'stops');
			expect(json).toHaveBeenCalledWith(mockResponse);
			expect(result.status).toBe(200);
			expect(result.body).toEqual(mockResponse);
		});

		it('should throw 404 when status code is 404', () => {
			const mockResponse = {
				code: 404,
				data: null
			};

			expect(() => handleOBAResponse(mockResponse, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(404, 'Unable to fetch stops.');
		});

		it('should throw 400 when status code is 400', () => {
			const mockResponse = {
				code: 400,
				data: null
			};

			expect(() => handleOBAResponse(mockResponse, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(400, 'Unable to fetch stops.');
		});

		it('should map 401, 403, 429, 500 to 502 Bad Gateway', () => {
			expect(() => handleOBAResponse({ code: 401, data: null }, 'stops')).toThrow(
				/Unable to fetch stops/
			);
			expect(error).toHaveBeenCalledWith(502, 'Unable to fetch stops.');

			expect(() => handleOBAResponse({ code: 403, data: null }, 'stops')).toThrow(
				/Unable to fetch stops/
			);
			expect(error).toHaveBeenCalledWith(502, 'Unable to fetch stops.');

			expect(() => handleOBAResponse({ code: 429, data: null }, 'stops')).toThrow(
				/Unable to fetch stops/
			);
			expect(error).toHaveBeenCalledWith(502, 'Unable to fetch stops.');

			expect(() => handleOBAResponse({ code: 500, data: null }, 'stops')).toThrow(
				/Unable to fetch stops/
			);
			expect(error).toHaveBeenCalledWith(502, 'Unable to fetch stops.');
		});

		it('should fall back to 500 when status code is invalid or unrecognized', () => {
			const mockResponse = {
				code: 999,
				data: null
			};

			expect(() => handleOBAResponse(mockResponse, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(500, 'Unable to fetch stops.');
		});

		it('should fall back to 500 when status code is fractional', () => {
			const mockResponse = {
				code: 404.5,
				data: null
			};

			expect(() => handleOBAResponse(mockResponse, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(500, 'Unable to fetch stops.');
		});

		it('should handle undefined response as 404', () => {
			expect(() => handleOBAResponse(undefined, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(404, 'Unable to fetch stops.');
		});

		it('should handle null response as 404', () => {
			expect(() => handleOBAResponse(null, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(404, 'Unable to fetch stops.');
		});

		it('should handle response with missing code gracefully as 500', () => {
			const mockResponse = {
				data: {
					stops: []
				}
			};

			expect(() => handleOBAResponse(mockResponse, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(500, 'Unable to fetch stops.');
		});
	});
});

describe('OBA Client Integration', () => {
	let oba;

	beforeEach(() => {
		vi.clearAllMocks();
		oba = new onebusaway({
			baseURL: 'https://test-api.example.com',
			apiKey: 'test-api-key'
		});
	});

	it('should handle successful API responses', async () => {
		const mockApiResponse = {
			code: 200,
			data: {
				stops: [{ id: 1, name: 'Test Stop' }]
			}
		};

		oba.stops = vi.fn().mockResolvedValue(mockApiResponse);

		const response = await oba.stops();
		const result = handleOBAResponse(response, 'stops');

		expect(json).toHaveBeenCalledWith(mockApiResponse);
		expect(result.status).toBe(200);
		expect(result.body).toEqual(mockApiResponse);
	});

	it('should handle failed API responses with mapped error status', async () => {
		const mockApiResponse = {
			code: 500,
			data: null
		};

		oba.stops = vi.fn().mockResolvedValue(mockApiResponse);

		const response = await oba.stops();

		expect(() => handleOBAResponse(response, 'stops')).toThrow(/Unable to fetch stops/);
		expect(error).toHaveBeenCalledWith(502, 'Unable to fetch stops.');
	});
});
