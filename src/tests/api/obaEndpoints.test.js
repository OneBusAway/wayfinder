/* eslint-disable no-restricted-syntax */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
	MockOnebusawaySDKError,
	MockAPIError,
	MockNotFoundError,
	MockAPIConnectionError,
	MockAPIConnectionTimeoutError,
	mockStopRetrieve,
	mockArrivalAndDepartureList,
	mockTripRetrieve
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
		mockStopRetrieve: vi.fn(),
		mockArrivalAndDepartureList: vi.fn(),
		mockTripRetrieve: vi.fn()
	};
});

vi.mock('onebusaway-sdk', () => {
	const MockOneBusAway = vi.fn().mockImplementation(() => ({
		stop: { retrieve: mockStopRetrieve },
		arrivalAndDeparture: { list: mockArrivalAndDepartureList },
		trip: { retrieve: mockTripRetrieve }
	}));
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

vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_SERVER_URL: 'https://test-api.example.com'
}));

vi.mock('$env/static/private', () => ({
	PRIVATE_OBA_API_KEY: 'test-api-key'
}));

vi.mock('$lib/agencyFilter.js', () => ({
	getAgencyFilter: () => null,
	filterByRouteId: (arrivals) => arrivals
}));

import { GET as getStop } from '../../routes/api/oba/stop/[stopID]/+server.js';
import { GET as getArrivals } from '../../routes/api/oba/arrivals-and-departures-for-stop/[id]/+server.js';
import { GET as getTrip } from '../../routes/api/oba/trip/[tripId]/+server.js';

describe('OBA API Routes error mapping (Puget Sound & upstream behaviors)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('GET /api/oba/stop/[stopID]', () => {
		it('returns 200 with JSON payload when stop exists', async () => {
			const mockStop = { code: 200, data: { entry: { id: '1_75403', name: 'Pine St' } } };
			mockStopRetrieve.mockResolvedValue(mockStop);

			const response = await getStop({ params: { stopID: '1_75403' } });
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual(mockStop);
		});

		it('throws 404 when OBA stop.retrieve returns null (Puget Sound missing stop behavior)', async () => {
			mockStopRetrieve.mockResolvedValue(null);

			await expect(getStop({ params: { stopID: '1_DOESNOTEXIST' } })).rejects.toMatchObject({
				status: 404,
				body: { message: 'Unable to fetch stop.' }
			});
		});

		it('throws 404 when OBA stop.retrieve throws NotFoundError', async () => {
			mockStopRetrieve.mockRejectedValue(new MockNotFoundError(404, {}, 'Not found'));

			await expect(getStop({ params: { stopID: '1_DOESNOTEXIST' } })).rejects.toMatchObject({
				status: 404,
				body: { message: 'Unable to fetch stop.' }
			});
		});

		it('throws 502 when upstream returns 401 or 403 (avoiding exposing rider auth errors)', async () => {
			mockStopRetrieve.mockRejectedValue(new MockAPIError(401, {}, 'Unauthorized'));

			await expect(getStop({ params: { stopID: '1_75403' } })).rejects.toMatchObject({
				status: 502,
				body: { message: 'Unable to fetch stop.' }
			});
		});
	});

	describe('GET /api/oba/arrivals-and-departures-for-stop/[id]', () => {
		it('returns 200 with arrivals data when stop exists', async () => {
			const mockData = { code: 200, data: { entry: { arrivalsAndDepartures: [] } } };
			mockArrivalAndDepartureList.mockResolvedValue(mockData);

			const response = await getArrivals({
				params: { id: '1_75403' },
				url: new URL('http://localhost/api/oba/arrivals-and-departures-for-stop/1_75403')
			});
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual(mockData);
		});

		it('throws 404 when OBA returns HTTP 404 (SDK throws NotFoundError)', async () => {
			mockArrivalAndDepartureList.mockRejectedValue(new MockNotFoundError(404, {}, 'Not found'));

			await expect(
				getArrivals({
					params: { id: '1_DOESNOTEXIST' },
					url: new URL('http://localhost/api/oba/arrivals-and-departures-for-stop/1_DOESNOTEXIST')
				})
			).rejects.toMatchObject({
				status: 404,
				body: { message: 'Unable to fetch arrivals-and-departures-for-stop.' }
			});
		});

		it('throws 502 when upstream rate limit is hit (429)', async () => {
			mockArrivalAndDepartureList.mockRejectedValue(new MockAPIError(429, {}, 'Too Many Requests'));

			await expect(
				getArrivals({
					params: { id: '1_75403' },
					url: new URL('http://localhost/api/oba/arrivals-and-departures-for-stop/1_75403')
				})
			).rejects.toMatchObject({
				status: 502,
				body: { message: 'Unable to fetch arrivals-and-departures-for-stop.' }
			});
		});
	});

	describe('GET /api/oba/trip/[tripId]', () => {
		it('returns 200 with trip data when trip exists', async () => {
			const mockTrip = { code: 200, data: { entry: { id: '1_12345' } } };
			mockTripRetrieve.mockResolvedValue(mockTrip);

			const response = await getTrip({ params: { tripId: '1_12345' } });
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual(mockTrip);
		});

		it('throws 404 when OBA returns HTTP 404 (SDK throws NotFoundError)', async () => {
			mockTripRetrieve.mockRejectedValue(new MockNotFoundError(404, {}, 'Not found'));

			await expect(getTrip({ params: { tripId: '1_DOESNOTEXIST' } })).rejects.toMatchObject({
				status: 404,
				body: { message: 'Unable to fetch trip.' }
			});
		});

		it('throws 502 when upstream OBA server encounters 500 error', async () => {
			mockTripRetrieve.mockRejectedValue(new MockAPIError(500, {}, 'Internal Server Error'));

			await expect(getTrip({ params: { tripId: '1_12345' } })).rejects.toMatchObject({
				status: 502,
				body: { message: 'Unable to fetch trip.' }
			});
		});
	});
});
