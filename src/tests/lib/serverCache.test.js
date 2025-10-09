import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the OBA SDK
const mockAgenciesWithCoverageList = vi.fn();
const mockRoutesForAgencyList = vi.fn();
const mockCalculateBoundsFromAgencies = vi.fn();

vi.mock('$lib/obaSdk.js', () => ({
	default: {
		agenciesWithCoverage: {
			list: (...args) => mockAgenciesWithCoverageList(...args)
		},
		routesForAgency: {
			list: (...args) => mockRoutesForAgencyList(...args)
		}
	}
}));

// Mock mathUtils
vi.mock('$lib/mathUtils.js', () => ({
	calculateBoundsFromAgencies: (...args) => mockCalculateBoundsFromAgencies(...args)
}));

describe('serverCache', () => {
	const mockAgencies = [
		{
			agencyId: 'agency1',
			name: 'Test Agency 1',
			lat: 47.6062,
			lon: -122.3321,
			latSpan: 1.0,
			lonSpan: 1.0
		},
		{
			agencyId: 'agency2',
			name: 'Test Agency 2',
			lat: 47.5,
			lon: -122.5,
			latSpan: 0.5,
			lonSpan: 0.5
		}
	];

	const mockBounds = {
		north: 48.1062,
		south: 47.0,
		east: -121.8321,
		west: -123.0
	};

	const mockRoutes1 = [
		{
			id: 'route1',
			agencyId: 'agency1',
			shortName: '1',
			longName: 'Route 1'
		},
		{
			id: 'route2',
			agencyId: 'agency1',
			shortName: '2',
			longName: 'Route 2'
		}
	];

	const mockRoutes2 = [
		{
			id: 'route3',
			agencyId: 'agency2',
			shortName: '3',
			longName: 'Route 3'
		}
	];

	const mockAgencyReferences = [
		{ id: 'agency1', name: 'Test Agency 1' },
		{ id: 'agency2', name: 'Test Agency 2' }
	];

	beforeEach(async () => {
		// Reset all mocks before each test
		vi.clearAllMocks();

		// Setup default mock implementations
		mockAgenciesWithCoverageList.mockResolvedValue({
			data: {
				list: mockAgencies
			}
		});

		mockCalculateBoundsFromAgencies.mockReturnValue(mockBounds);

		mockRoutesForAgencyList.mockImplementation((agencyId) => {
			if (agencyId === 'agency1') {
				return Promise.resolve({
					data: {
						list: mockRoutes1,
						references: {
							agencies: mockAgencyReferences
						}
					}
				});
			} else if (agencyId === 'agency2') {
				return Promise.resolve({
					data: {
						list: mockRoutes2,
						references: {
							agencies: mockAgencyReferences
						}
					}
				});
			}
			return Promise.resolve({
				data: {
					list: [],
					references: {
						agencies: []
					}
				}
			});
		});

		// Reset module to clear cache between tests
		vi.resetModules();

		// Import and clear cache to ensure clean state
		const { clearCache } = await import('$lib/serverCache.js');
		clearCache();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('preloadRoutesData', () => {
		it('should fetch and cache routes data on first call', async () => {
			const { preloadRoutesData, getRoutesCache, getAgenciesCache, getBoundsCache, getCacheState } =
				await import('$lib/serverCache.js');

			await preloadRoutesData();

			// Verify API calls were made
			expect(mockAgenciesWithCoverageList).toHaveBeenCalledTimes(1);
			expect(mockRoutesForAgencyList).toHaveBeenCalledTimes(2);
			expect(mockRoutesForAgencyList).toHaveBeenCalledWith('agency1');
			expect(mockRoutesForAgencyList).toHaveBeenCalledWith('agency2');

			// Verify bounds calculation
			expect(mockCalculateBoundsFromAgencies).toHaveBeenCalledWith(mockAgencies);

			// Verify caches are populated
			expect(getAgenciesCache()).toEqual(mockAgencies);
			expect(getBoundsCache()).toEqual(mockBounds);
			expect(getCacheState()).toBe('loaded');

			const routes = getRoutesCache();
			expect(routes).toHaveLength(3);
			expect(routes).toEqual(expect.arrayContaining([...mockRoutes1, ...mockRoutes2]));
		});

		it('should not refetch data on subsequent calls (caching)', async () => {
			const { preloadRoutesData } = await import('$lib/serverCache.js');

			await preloadRoutesData();
			await preloadRoutesData();
			await preloadRoutesData();

			// Should only call API once
			expect(mockAgenciesWithCoverageList).toHaveBeenCalledTimes(1);
			expect(mockRoutesForAgencyList).toHaveBeenCalledTimes(2);
		});

		it('should attach agency info to routes', async () => {
			const { preloadRoutesData, getRoutesCache } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			const routes = getRoutesCache();
			const route1 = routes.find((r) => r.id === 'route1');

			expect(route1.agencyInfo).toEqual({
				id: 'agency1',
				name: 'Test Agency 1'
			});
		});

		it('should handle API errors gracefully', async () => {
			mockAgenciesWithCoverageList.mockRejectedValue(new Error('API Error'));

			const { preloadRoutesData, getRoutesCache, getCacheState } = await import(
				'$lib/serverCache.js'
			);

			// Should not throw
			await expect(preloadRoutesData()).resolves.not.toThrow();

			// Cache should be null and state should be error
			expect(getRoutesCache()).toBeNull();
			expect(getCacheState()).toBe('error');
		});

		it('should log errors to console with enhanced context', async () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			mockAgenciesWithCoverageList.mockRejectedValue(new Error('API Error'));

			const { preloadRoutesData } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Error fetching routes:',
				expect.objectContaining({
					error: 'API Error',
					stack: expect.any(String),
					timestamp: expect.any(String)
				})
			);

			consoleErrorSpy.mockRestore();
		});

		it('should handle concurrent calls without duplicate API requests', async () => {
			const { preloadRoutesData } = await import('$lib/serverCache.js');

			// Call preloadRoutesData multiple times concurrently
			await Promise.all([preloadRoutesData(), preloadRoutesData(), preloadRoutesData()]);

			// Should only call API once despite concurrent requests
			expect(mockAgenciesWithCoverageList).toHaveBeenCalledTimes(1);
			expect(mockRoutesForAgencyList).toHaveBeenCalledTimes(2);
		});

		it('should force refresh when forceRefresh is true', async () => {
			const { preloadRoutesData } = await import('$lib/serverCache.js');

			await preloadRoutesData();
			await preloadRoutesData(true); // Force refresh

			// Should call API twice
			expect(mockAgenciesWithCoverageList).toHaveBeenCalledTimes(2);
			expect(mockRoutesForAgencyList).toHaveBeenCalledTimes(4);
		});

		it('should refresh stale cache after TTL expires', async () => {
			vi.useFakeTimers();

			const { preloadRoutesData } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			// Fast-forward 1 hour + 1ms to exceed TTL
			vi.advanceTimersByTime(3600001);

			await preloadRoutesData();

			// Should call API twice due to stale cache
			expect(mockAgenciesWithCoverageList).toHaveBeenCalledTimes(2);

			vi.useRealTimers();
		});
	});

	describe('getRoutesCache', () => {
		it('should return null when cache is empty', async () => {
			const { getRoutesCache } = await import('$lib/serverCache.js');

			expect(getRoutesCache()).toBeNull();
		});

		it('should return cached routes after successful preload', async () => {
			const { preloadRoutesData, getRoutesCache } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			const routes = getRoutesCache();
			expect(routes).toHaveLength(3);
			expect(routes[0]).toHaveProperty('id');
			expect(routes[0]).toHaveProperty('agencyId');
			expect(routes[0]).toHaveProperty('shortName');
			expect(routes[0]).toHaveProperty('longName');
			expect(routes[0]).toHaveProperty('agencyInfo');
		});
	});

	describe('getAgenciesCache', () => {
		it('should return null when cache is empty', async () => {
			const { getAgenciesCache } = await import('$lib/serverCache.js');

			expect(getAgenciesCache()).toBeNull();
		});

		it('should return cached agencies after successful preload', async () => {
			const { preloadRoutesData, getAgenciesCache } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			const agencies = getAgenciesCache();
			expect(agencies).toEqual(mockAgencies);
		});
	});

	describe('getBoundsCache', () => {
		it('should return null when cache is empty', async () => {
			const { getBoundsCache } = await import('$lib/serverCache.js');

			expect(getBoundsCache()).toBeNull();
		});

		it('should return cached bounds after successful preload', async () => {
			const { preloadRoutesData, getBoundsCache } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			const bounds = getBoundsCache();
			expect(bounds).toEqual(mockBounds);
		});

		it('should use bounds calculated from agencies', async () => {
			const { preloadRoutesData, getBoundsCache } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			expect(mockCalculateBoundsFromAgencies).toHaveBeenCalledWith(mockAgencies);
			expect(getBoundsCache()).toEqual(mockBounds);
		});
	});

	describe('getCacheState', () => {
		it('should return "uninitialized" when cache is empty', async () => {
			const { getCacheState } = await import('$lib/serverCache.js');

			expect(getCacheState()).toBe('uninitialized');
		});

		it('should return "loaded" after successful preload', async () => {
			const { preloadRoutesData, getCacheState } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			expect(getCacheState()).toBe('loaded');
		});

		it('should return "error" after failed preload', async () => {
			mockAgenciesWithCoverageList.mockRejectedValue(new Error('API Error'));

			const { preloadRoutesData, getCacheState } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			expect(getCacheState()).toBe('error');
		});
	});

	describe('getCacheTimestamp', () => {
		it('should return null when cache is empty', async () => {
			const { getCacheTimestamp } = await import('$lib/serverCache.js');

			expect(getCacheTimestamp()).toBeNull();
		});

		it('should return timestamp after successful preload', async () => {
			const { preloadRoutesData, getCacheTimestamp } = await import('$lib/serverCache.js');

			const before = Date.now();
			await preloadRoutesData();
			const after = Date.now();

			const timestamp = getCacheTimestamp();
			expect(timestamp).toBeGreaterThanOrEqual(before);
			expect(timestamp).toBeLessThanOrEqual(after);
		});

		it('should return null after failed preload', async () => {
			mockAgenciesWithCoverageList.mockRejectedValue(new Error('API Error'));

			const { preloadRoutesData, getCacheTimestamp } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			expect(getCacheTimestamp()).toBeNull();
		});
	});

	describe('clearCache', () => {
		it('should clear all cached data', async () => {
			const {
				preloadRoutesData,
				clearCache,
				getRoutesCache,
				getAgenciesCache,
				getBoundsCache,
				getCacheState,
				getCacheTimestamp
			} = await import('$lib/serverCache.js');

			await preloadRoutesData();

			// Verify cache is populated
			expect(getRoutesCache()).not.toBeNull();
			expect(getAgenciesCache()).not.toBeNull();
			expect(getBoundsCache()).not.toBeNull();
			expect(getCacheState()).toBe('loaded');
			expect(getCacheTimestamp()).not.toBeNull();

			clearCache();

			// Verify cache is cleared
			expect(getRoutesCache()).toBeNull();
			expect(getAgenciesCache()).toBeNull();
			expect(getBoundsCache()).toBeNull();
			expect(getCacheState()).toBe('uninitialized');
			expect(getCacheTimestamp()).toBeNull();
		});
	});

	describe('route flattening and aggregation', () => {
		it('should flatten routes from multiple agencies into single array', async () => {
			const { preloadRoutesData, getRoutesCache } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			const routes = getRoutesCache();

			// Should have routes from both agencies
			const agency1Routes = routes.filter((r) => r.agencyId === 'agency1');
			const agency2Routes = routes.filter((r) => r.agencyId === 'agency2');

			expect(agency1Routes).toHaveLength(2);
			expect(agency2Routes).toHaveLength(1);
		});

		it('should handle agencies with no routes', async () => {
			mockRoutesForAgencyList.mockResolvedValue({
				data: {
					list: [],
					references: {
						agencies: []
					}
				}
			});

			const { preloadRoutesData, getRoutesCache } = await import('$lib/serverCache.js');

			await preloadRoutesData();

			const routes = getRoutesCache();
			expect(routes).toEqual([]);
		});
	});
});
