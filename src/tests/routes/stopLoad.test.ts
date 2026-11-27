import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
	MockOnebusawaySDKError,
	MockAPIError,
	MockNotFoundError,
	MockAPIConnectionError,
	MockAPIConnectionTimeoutError,
	mockStopRetrieve,
	mockArrivalAndDepartureList
} = vi.hoisted(() => {
	class MockOnebusawaySDKError extends Error {
		constructor(message?: string) {
			super(message);
			this.name = 'OnebusawaySDKError';
		}
	}

	class MockAPIError extends MockOnebusawaySDKError {
		status: number | undefined;
		constructor(status?: number, errorData?: unknown, message?: string) {
			super(message || `${status}`);
			this.name = 'APIError';
			this.status = status;
		}
	}

	class MockNotFoundError extends MockAPIError {
		constructor(status = 404, errorData?: unknown, message?: string) {
			super(status, errorData, message || 'Not found');
			this.name = 'NotFoundError';
		}
	}

	class MockAPIConnectionError extends MockAPIError {
		constructor(message?: string) {
			super(undefined, undefined, message || 'Connection error');
			this.name = 'APIConnectionError';
			this.status = undefined;
		}
	}

	class MockAPIConnectionTimeoutError extends MockAPIConnectionError {
		constructor(message?: string) {
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
		mockArrivalAndDepartureList: vi.fn()
	};
});

vi.mock('onebusaway-sdk', () => {
	class MockOneBusAway {
		static OnebusawaySDKError = MockOnebusawaySDKError;
		static APIError = MockAPIError;
		static NotFoundError = MockNotFoundError;
		static APIConnectionError = MockAPIConnectionError;
		static APIConnectionTimeoutError = MockAPIConnectionTimeoutError;

		stop = { retrieve: mockStopRetrieve };
		arrivalAndDeparture = { list: mockArrivalAndDepartureList };
	}
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

const mockFilterByRouteId = vi.hoisted(() => vi.fn((arrivals: unknown) => arrivals));
const mockGetAgencyFilter = vi.hoisted(() => vi.fn<() => string[] | null>(() => null));

vi.mock('$lib/agencyFilter.js', () => ({
	filterByRouteId: mockFilterByRouteId,
	getAgencyFilter: mockGetAgencyFilter
}));

import { load } from '../../routes/stops/[stopID]/+page.server.js';

const createLoadEvent = (stopID: string) =>
	({ params: { stopID } }) as unknown as Parameters<typeof load>[0];

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

		const result = await load(createLoadEvent('1_75403'));

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

		await expect(load(createLoadEvent('1_DOESNOTEXIST'))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Unable to fetch stop.' }
		});
	});

	it('throws 404 when stop.retrieve throws NotFoundError (real HTTP 404 from upstream OBA)', async () => {
		mockStopRetrieve.mockRejectedValue(new MockNotFoundError(404, {}, 'Stop not found'));

		await expect(load(createLoadEvent('1_DOESNOTEXIST'))).rejects.toMatchObject({
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

		await expect(load(createLoadEvent('1_75403'))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Unable to fetch arrivals-and-departures-for-stop.' }
		});
	});

	it('throws 502 when upstream returns authentication or permission error (401/403)', async () => {
		mockStopRetrieve.mockRejectedValue(new MockAPIError(401, {}, 'Unauthorized'));

		await expect(load(createLoadEvent('1_75403'))).rejects.toMatchObject({
			status: 502,
			body: { message: 'Unable to fetch stop.' }
		});
	});

	it('throws 502 when upstream returns rate-limit error (429)', async () => {
		mockStopRetrieve.mockRejectedValue(new MockAPIError(429, {}, 'Too Many Requests'));

		await expect(load(createLoadEvent('1_75403'))).rejects.toMatchObject({
			status: 502,
			body: { message: 'Unable to fetch stop.' }
		});
	});

	it('throws 502 when upstream returns server error (500)', async () => {
		mockStopRetrieve.mockRejectedValue(new MockAPIError(500, {}, 'Internal Server Error'));

		await expect(load(createLoadEvent('1_75403'))).rejects.toMatchObject({
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

		const result = await load(createLoadEvent('1_75403'));

		expect(mockFilterByRouteId).toHaveBeenCalledWith(mockArrivals, ['1']);
		expect(result.arrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures).toEqual([
			{ tripId: '1_1', routeId: '1_A' }
		]);
	});
});
