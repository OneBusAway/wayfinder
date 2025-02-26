import { fetchRoutesData, getRoutesCache } from '../path-to-your-file.js'; // Update the path as needed

// Mock the oba SDK to avoid making real API calls
jest.mock('$lib/obaSdk.js', () => ({
	agenciesWithCoverage: {
		list: jest.fn().mockResolvedValue({
			data: {
				list: [{ agencyId: '1', name: 'Test Agency' }], // Fake agency data for testing
			},
		}),
	},
	routesForAgency: {
		list: jest.fn().mockResolvedValue({
			data: {
				list: [{ id: 'route1', agencyId: '1', shortName: 'R1' }], // Fake route data
				references: { agencies: [{ id: '1', name: 'Test Agency' }] }, // Fake agency reference
			},
		}),
	},
}));

// Grouping tests related to fetchRoutesData()
describe('fetchRoutesData', () => {

	// Test: Should successfully fetch and return routes
	it('should fetch and return routes successfully', async () => {
		const routes = await fetchRoutesData(); // Call the function

		// Ensure routes are fetched and not empty
		expect(routes).toBeDefined();
		expect(routes.length).toBeGreaterThan(0);

		// Check if the first route has the expected properties
		expect(routes[0]).toHaveProperty('id', 'route1');
		expect(routes[0]).toHaveProperty('agencyInfo');
		expect(routes[0].agencyInfo).toHaveProperty('name', 'Test Agency');
	});

	// Test: Should update the cache after fetching data
	it('should update the cache after fetching data', async () => {
		await fetchRoutesData(); // Fetch data to populate cache
		const cachedRoutes = getRoutesCache(); // Get cached routes

		// Ensure cache exists and contains data
		expect(cachedRoutes).toBeDefined();
		expect(cachedRoutes.length).toBeGreaterThan(0);
	});
});

/**
 *  Expected Output When Running Tests:
 *
 * PASS  tests/fetchRoutesData.test.js
 * ✓ should fetch and return routes successfully (X ms)
 * ✓ should update the cache after fetching data (X ms)
 *
 * Test Suites: 1 passed, 1 total
 * Tests:       2 passed, 2 total
 * Snapshots:   0 total
 * Time:        0.Xs, estimated Xs
 * Ran all test suites.
 *
 * If a test fails, Jest will show error messages explaining what went wrong.
 */
