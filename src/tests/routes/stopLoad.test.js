/* eslint-disable no-restricted-syntax */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
	MockOnebusawaySDKError,
	MockAPIError,
	MockNotFoundError,
	mockStopRetrieve,
	mockArrivalAndDepartureList
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

	return {
		MockOnebusawaySDKError,
		MockAPIError,
		MockNotFoundError,
		mockStopRetrieve: vi.fn(),
		mockArrivalAndDepartureList: vi.fn()
	};
});

vi.mock('onebusaway-sdk', () => {
	const MockOneBusAway = vi.fn().mockImplementation(() => ({
		stop: { retrieve: mockStopRetrieve },
		arrivalAndDeparture: { list: mockArrivalAndDepartureList }
	}));
	MockOneBusAway.OnebusawaySDKError = MockOnebusawaySDKError;
	MockOneBusAway.APIError = MockAPIError;
	MockOneBusAway.NotFoundError = MockNotFoundError;
	return {
		default: MockOneBusAway,
		OnebusawaySDKError: MockOnebusawaySDKError,
		APIError: MockAPIError,
		NotFoundError: MockNotFoundError
	};
});

vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_SERVER_URL: 'https://test-api.example.com'
}));

vi.mock('$env/static/private', () => ({
	PRIVATE_OBA_API_KEY: 'test-api-key'
}));

const mockFilterByRouteId = vi.hoisted(() => vi.fn((arrivals) => arrivals));
const mockGetAgencyFilter = vi.hoisted(() => vi.fn(() => null));

vi.mock('$lib/agencyFilter.js', () => ({
	filterByRouteId: mockFilterByRouteId,
	getAgencyFilter: mockGetAgencyFilter
}));

import { load } from '../../routes/stops/[stopID]/+page.server.js';

describe('/stops/[stopID] page server load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads stop and arrivals data successfully on HTTP 200', async () => {
		const mockStopEntry = { id: '1_75403', name: 'Pine St & 3rd Ave', lat: 47.61, lon: -122.33 };
		const mockArrivals = [{ tripId: '1_123', routeShortName: '10' }];

		mockStopRetrieve.mockResolvedValue({
			code: 200,
			data: { entry: mockStopEntry }
		});
		mockArrivalAndDepartureList.mockResolvedValue({
			code: 200,
			data: { entry: { arrivalsAndDepartures: mockArrivals } }
		});

		const result = await load({ params: { stopID: '1_75403' } });

		expect(mockStopRetrieve).toHaveBeenCalledWith('1_75403');
		expect(mockArrivalAndDepartureList).toHaveBeenCalledWith('1_75403');
		expect(result.stopID).toBe('1_75403');
		expect(result.stopData).toEqual({ entry: mockStopEntry });
		expect(result.arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures).toEqual(
			mockArrivals
		);
	});

	it('throws 404 when stop.retrieve returns null (Puget Sound unknown stop behavior)', async () => {
		mockStopRetrieve.mockResolvedValue(null);

		await expect(load({ params: { stopID: '1_DOESNOTEXIST' } })).rejects.toMatchObject({
			status: 404,
			body: { message: 'Unable to fetch stop.' }
		});
	});

	it('throws 404 when stop.retrieve throws NotFoundError (real HTTP 404 from upstream OBA)', async () => {
		mockStopRetrieve.mockRejectedValue(new MockNotFoundError(404, {}, 'Stop not found'));

		await expect(load({ params: { stopID: '1_DOESNOTEXIST' } })).rejects.toMatchObject({
			status: 404,
			body: { message: 'Unable to fetch stop.' }
		});
	});

	it('throws 404 when arrivalAndDeparture.list throws NotFoundError', async () => {
		mockStopRetrieve.mockResolvedValue({
			code: 200,
			data: { entry: { id: '1_75403' } }
		});
		mockArrivalAndDepartureList.mockRejectedValue(
			new MockNotFoundError(404, {}, 'Arrivals not found')
		);

		await expect(load({ params: { stopID: '1_75403' } })).rejects.toMatchObject({
			status: 404,
			body: { message: 'Unable to fetch arrivals-and-departures-for-stop.' }
		});
	});

	it('throws 502 when upstream returns authentication or permission error (401/403)', async () => {
		mockStopRetrieve.mockRejectedValue(new MockAPIError(401, {}, 'Unauthorized'));

		await expect(load({ params: { stopID: '1_75403' } })).rejects.toMatchObject({
			status: 502,
			body: { message: 'Unable to fetch stop.' }
		});
	});

	it('throws 502 when upstream returns rate-limit error (429)', async () => {
		mockStopRetrieve.mockRejectedValue(new MockAPIError(429, {}, 'Too Many Requests'));

		await expect(load({ params: { stopID: '1_75403' } })).rejects.toMatchObject({
			status: 502,
			body: { message: 'Unable to fetch stop.' }
		});
	});

	it('throws 502 when upstream returns server error (500)', async () => {
		mockStopRetrieve.mockRejectedValue(new MockAPIError(500, {}, 'Internal Server Error'));

		await expect(load({ params: { stopID: '1_75403' } })).rejects.toMatchObject({
			status: 502,
			body: { message: 'Unable to fetch stop.' }
		});
	});

	it('applies agency filtering to arrivals when configured', async () => {
		const mockArrivals = [
			{ tripId: '1_1', routeId: '1_A' },
			{ tripId: '2_2', routeId: '2_B' }
		];
		mockStopRetrieve.mockResolvedValue({
			code: 200,
			data: { entry: { id: '1_75403' } }
		});
		mockArrivalAndDepartureList.mockResolvedValue({
			code: 200,
			data: { entry: { arrivalsAndDepartures: mockArrivals } }
		});

		mockGetAgencyFilter.mockReturnValue(['1']);
		mockFilterByRouteId.mockReturnValue([{ tripId: '1_1', routeId: '1_A' }]);

		const result = await load({ params: { stopID: '1_75403' } });

		expect(mockFilterByRouteId).toHaveBeenCalledWith(mockArrivals, ['1']);
		expect(result.arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures).toEqual([
			{ tripId: '1_1', routeId: '1_A' }
		]);
	});
});
