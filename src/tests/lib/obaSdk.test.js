import { describe, it, expect, vi, beforeEach } from 'vitest';
import onebusaway from 'onebusaway-sdk';
import { handleOBAResponse } from '$lib/obaSdk';
import { error, json } from '@sveltejs/kit';

// Mock the onebusaway-sdk
vi.mock('onebusaway-sdk');

// Mock @sveltejs/kit error and json functions
vi.mock('@sveltejs/kit', () => ({
	error: vi.fn((status, message) => {
		throw new Error(message);
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

		it('should throw error when status code is not 200', () => {
			const mockResponse = {
				code: 404,
				data: null
			};

			expect(() => handleOBAResponse(mockResponse, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(500, 'Unable to fetch stops.');
		});

		it('should handle undefined response gracefully', () => {
			expect(() => handleOBAResponse(undefined, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(500, 'Unable to fetch stops.');
		});

		it('should handle null response gracefully', () => {
			expect(() => handleOBAResponse(null, 'stops')).toThrow(/Unable to fetch stops/);
			expect(error).toHaveBeenCalledWith(500, 'Unable to fetch stops.');
		});

		it('should handle response with missing code gracefully', () => {
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

		// Mock a successful API call
		oba.stops = vi.fn().mockResolvedValue(mockApiResponse);

		const response = await oba.stops();
		const result = handleOBAResponse(response, 'stops');

		expect(json).toHaveBeenCalledWith(mockApiResponse);
		expect(result.status).toBe(200);
		expect(result.body).toEqual(mockApiResponse);
	});

	it('should handle failed API responses', async () => {
		const mockApiResponse = {
			code: 500,
			data: null
		};

		// Mock a failed API call
		oba.stops = vi.fn().mockResolvedValue(mockApiResponse);

		const response = await oba.stops();

		expect(() => handleOBAResponse(response, 'stops')).toThrow(/Unable to fetch stops/);
		expect(error).toHaveBeenCalledWith(500, 'Unable to fetch stops.');
	});
});
