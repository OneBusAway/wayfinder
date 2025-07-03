import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { createMockStore } from '../../../tests/helpers/test-utils.js';
import SearchPane from '../SearchPane.svelte';

// Mock dependencies
vi.mock('$lib/Analytics/PlausibleAnalytics', () => ({
	default: {
		reportSearchQuery: vi.fn()
	}
}));

vi.mock('$lib/vehicleUtils', () => ({
	clearVehicleMarkersMap: vi.fn(),
	fetchAndUpdateVehicles: vi.fn().mockResolvedValue('interval-id-123')
}));

vi.mock('$lib/mathUtils', () => ({
	calculateMidpoint: vi.fn().mockReturnValue({ lat: 47.6062, lng: -122.3321 })
}));

vi.mock('$config/routeConfig', () => ({
	prioritizedRouteTypeForDisplay: vi.fn().mockReturnValue('bus')
}));

vi.mock('$stores/mapStore', () => ({
	isMapLoaded: createMockStore(true)
}));

vi.mock('$stores/surveyStore', () => ({
	surveyStore: createMockStore({ id: 'survey-1', title: 'Test Survey' }),
	answeredSurveys: createMockStore({ 'survey-1': false })
}));

vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_OTP_SERVER_URL: 'https://otp.example.com'
	}
}));

describe('SearchPane', () => {
	let mockProps;
	let mockMapProvider;
	let mockFetch;

	beforeEach(() => {
		// Mock map provider
		mockMapProvider = {
			panTo: vi.fn(),
			setZoom: vi.fn(),
			flyTo: vi.fn(),
			createPolyline: vi.fn().mockReturnValue('polyline-mock'),
			addStopMarker: vi.fn(),
			clearVehicleMarkers: vi.fn()
		};

		// Mock props
		mockProps = {
			clearPolylines: vi.fn(),
			handleRouteSelected: vi.fn(),
			handleViewAllRoutes: vi.fn(),
			handleTripPlan: vi.fn(),
			cssClasses: 'test-class',
			mapProvider: mockMapProvider,
			childContent: () => 'Survey Content'
		};

		// Mock fetch globally
		mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({
				results: [
					{
						id: 'stop-123',
						name: 'Test Stop for query',
						type: 'stop',
						lat: 47.6062,
						lon: -122.3321
					}
				]
			})
		});
		global.fetch = mockFetch;

		// Mock window.addEventListener
		global.addEventListener = vi.fn();
		global.removeEventListener = vi.fn();
		global.dispatchEvent = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Component Rendering', () => {
		test('renders search pane with tabs and search field', () => {
			render(SearchPane, { props: mockProps });

			// Check for main tab
			expect(screen.getByText('tabs.stops-and-stations')).toBeInTheDocument();

			// Check for search field
			expect(screen.getByRole('textbox')).toBeInTheDocument();
			expect(screen.getByRole('button')).toBeInTheDocument();
		});

		test('renders trip planning tab when OTP server is configured', () => {
			render(SearchPane, { props: mockProps });

			expect(screen.getByText('tabs.plan_trip')).toBeInTheDocument();
		});

		test('applies custom CSS classes', () => {
			const { container } = render(SearchPane, { props: mockProps });

			expect(container.firstChild).toHaveClass('test-class');
		});

		test('renders survey content when survey is not answered', () => {
			render(SearchPane, { props: mockProps });

			expect(screen.getByText('Survey Content')).toBeInTheDocument();
		});
	});

	describe('Search Functionality', () => {
		test('handles search results with stops, routes, and locations', async () => {
			const user = userEvent.setup();

			// Mock comprehensive search response
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					stops: [
						{
							id: 'stop-123',
							name: 'Test Stop',
							lat: 47.6062,
							lon: -122.3321,
							code: '12345',
							direction: 'N'
						}
					],
					routes: [
						{
							id: 'route-44',
							nullSafeShortName: '44',
							description: 'University District Express',
							type: 3
						}
					],
					location: {
						formatted_address: '123 Test St, Seattle, WA',
						geometry: {
							location: { lat: 47.6062, lng: -122.3321 }
						},
						types: ['establishment', 'point_of_interest']
					},
					query: 'University District'
				})
			});

			render(SearchPane, { props: mockProps });

			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'University District');
			await user.click(searchButton);

			await waitFor(() => {
				// Check for stop result
				expect(screen.getByText('Test Stop')).toBeInTheDocument();
				expect(screen.getByText(/Code: 12345/)).toBeInTheDocument();

				// Check for route result
				expect(screen.getByText(/route 44/)).toBeInTheDocument();
				expect(screen.getByText('University District Express')).toBeInTheDocument();

				// Check for location result
				expect(screen.getByText('123 Test St, Seattle, WA')).toBeInTheDocument();

				// Check for query display
				expect(screen.getByText(/results_for.*University District/)).toBeInTheDocument();
			});
		});

		test('displays clear results button and functionality', async () => {
			const user = userEvent.setup();

			render(SearchPane, { props: mockProps });

			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'Test Query');
			await user.click(searchButton);

			await waitFor(() => {
				expect(screen.getByText(/results_for.*Test Query/)).toBeInTheDocument();
			});

			const clearButton = screen.getByText('search.clear_results');
			await user.click(clearButton);

			// Results should be cleared
			expect(screen.queryByText(/results_for/)).not.toBeInTheDocument();
			expect(mockProps.clearPolylines).toHaveBeenCalled();
		});

		test('handles empty search results gracefully', async () => {
			const user = userEvent.setup();

			// Mock empty response
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					stops: [],
					routes: [],
					location: null,
					query: 'nonexistent'
				})
			});

			render(SearchPane, { props: mockProps });

			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'nonexistent');
			await user.click(searchButton);

			await waitFor(() => {
				expect(screen.getByText(/results_for.*nonexistent/)).toBeInTheDocument();
			});

			// Should not show any result items
			expect(screen.queryByRole('button', { name: /Test Stop/ })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /route/ })).not.toBeInTheDocument();
		});
	});

	describe('Result Item Interactions', () => {
		test('handles location click and map navigation', async () => {
			const user = userEvent.setup();

			// Mock location search response
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					location: {
						formatted_address: '123 Test St, Seattle, WA',
						geometry: {
							location: { lat: 47.6062, lng: -122.3321 }
						},
						types: ['establishment']
					},
					query: 'Test Location'
				})
			});

			render(SearchPane, { props: mockProps });

			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'Test Location');
			await user.click(searchButton);

			await waitFor(() => {
				expect(screen.getByText('123 Test St, Seattle, WA')).toBeInTheDocument();
			});

			const locationButton = screen.getByRole('button', { name: /123 Test St/ });
			await user.click(locationButton);

			expect(mockMapProvider.panTo).toHaveBeenCalledWith(47.6062, -122.3321);
			expect(mockMapProvider.setZoom).toHaveBeenCalledWith(20);
		});

		test('handles stop click and map navigation', async () => {
			const user = userEvent.setup();

			// Mock stop search response
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					stops: [
						{
							id: 'stop-123',
							name: 'Test Stop',
							lat: 47.6062,
							lon: -122.3321,
							code: '12345',
							direction: 'N'
						}
					],
					query: 'Test Stop'
				})
			});

			render(SearchPane, { props: mockProps });

			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'Test Stop');
			await user.click(searchButton);

			await waitFor(() => {
				expect(screen.getByText('Test Stop')).toBeInTheDocument();
			});

			const stopButton = screen.getByRole('button', { name: /Test Stop/ });
			await user.click(stopButton);

			expect(mockMapProvider.panTo).toHaveBeenCalledWith(47.6062, -122.3321);
			expect(mockMapProvider.setZoom).toHaveBeenCalledWith(20);
		});

		test('handles route click with polyline rendering and vehicle tracking', async () => {
			const user = userEvent.setup();

			// Mock route search response
			global.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue({
						routes: [
							{
								id: 'route-44',
								nullSafeShortName: '44',
								description: 'University District Express',
								type: 3
							}
						],
						query: 'Route 44'
					})
				})
				// Mock stops-for-route response
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue({
						data: {
							references: {
								stops: [
									{ id: 'stop-1', lat: 47.6062, lon: -122.3321 },
									{ id: 'stop-2', lat: 47.6072, lon: -122.3331 }
								]
							},
							entry: {
								polylines: [{ points: 'encoded-polyline-data' }]
							}
						}
					})
				});

			render(SearchPane, { props: mockProps });

			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'Route 44');
			await user.click(searchButton);

			await waitFor(() => {
				expect(screen.getByText(/route 44/)).toBeInTheDocument();
			});

			const routeButton = screen.getByRole('button', { name: /route 44/ });
			await user.click(routeButton);

			await waitFor(() => {
				// Check map interactions
				expect(mockMapProvider.flyTo).toHaveBeenCalledWith(47.6062, -122.3321, 12);
				expect(mockMapProvider.createPolyline).toHaveBeenCalledWith('encoded-polyline-data');
				expect(mockMapProvider.addStopMarker).toHaveBeenCalledTimes(2);

				// Check route selection callback
				expect(mockProps.handleRouteSelected).toHaveBeenCalledWith(
					expect.objectContaining({
						route: expect.objectContaining({ id: 'route-44' }),
						stops: expect.any(Array),
						polylines: expect.any(Array),
						currentIntervalId: 'interval-id-123'
					})
				);
			});
		});
	});

	describe('Tab Navigation and Accessibility', () => {
		test('supports keyboard navigation between tabs', async () => {
			const user = userEvent.setup();

			render(SearchPane, { props: mockProps });

			const stopsTab = screen.getByRole('tab', { name: /stops-and-stations/ });
			const tripTab = screen.getByRole('tab', { name: /plan_trip/ });

			// Start with stops tab
			expect(stopsTab).toHaveAttribute('aria-selected', 'true');

			// Navigate to trip planning tab
			await user.click(tripTab);
			expect(tripTab).toHaveAttribute('aria-selected', 'true');
			expect(stopsTab).toHaveAttribute('aria-selected', 'false');
		});

		test('trip planning tab is disabled when map is not loaded', () => {
			// Mock map not loaded
			vi.mocked(vi.importActual('$stores/mapStore')).isMapLoaded = createMockStore(false);

			render(SearchPane, { props: mockProps });

			const tripTab = screen.getByRole('tab', { name: /plan_trip/ });
			expect(tripTab).toBeDisabled();
		});

		test('emits custom events for tab interactions', async () => {
			const user = userEvent.setup();

			render(SearchPane, { props: mockProps });

			const stopsTab = screen.getByRole('tab', { name: /stops-and-stations/ });
			const tripTab = screen.getByRole('tab', { name: /plan_trip/ });

			await user.click(stopsTab);
			expect(global.dispatchEvent).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'tabSwitched' })
			);

			await user.click(tripTab);
			expect(global.dispatchEvent).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'planTripTabClicked' })
			);
		});

		test('handles view all routes link', async () => {
			const user = userEvent.setup();

			render(SearchPane, { props: mockProps });

			const viewAllRoutesLink = screen.getByText('search.click_here');
			await user.click(viewAllRoutesLink);

			expect(mockProps.handleViewAllRoutes).toHaveBeenCalled();
		});
	});

	describe('Survey Integration', () => {
		test('shows survey content when survey exists and is not answered', () => {
			render(SearchPane, { props: mockProps });

			expect(screen.getByText('Survey Content')).toBeInTheDocument();
		});

		test('hides survey content when survey is answered', () => {
			// Mock answered survey
			vi.mocked(vi.importActual('$stores/surveyStore')).answeredSurveys = createMockStore({
				'survey-1': true
			});

			render(SearchPane, { props: mockProps });

			expect(screen.queryByText('Survey Content')).not.toBeInTheDocument();
		});

		test('hides survey content when no survey exists', () => {
			// Mock no survey
			vi.mocked(vi.importActual('$stores/surveyStore')).surveyStore = createMockStore(null);

			render(SearchPane, { props: mockProps });

			expect(screen.queryByText('Survey Content')).not.toBeInTheDocument();
		});
	});

	describe('Component Lifecycle and Cleanup', () => {
		test('sets up event listeners on mount', () => {
			render(SearchPane, { props: mockProps });

			expect(global.addEventListener).toHaveBeenCalledWith(
				'routeSelectedFromModal',
				expect.any(Function)
			);
		});

		test('clears polylines and markers when clearing results', async () => {
			const user = userEvent.setup();

			render(SearchPane, { props: mockProps });

			// Trigger search to have results
			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'Test Query');
			await user.click(searchButton);

			await waitFor(() => {
				expect(screen.getByText(/results_for/)).toBeInTheDocument();
			});

			// Clear results
			const clearButton = screen.getByText('search.clear_results');
			await user.click(clearButton);

			expect(mockProps.clearPolylines).toHaveBeenCalled();
			expect(mockMapProvider.clearVehicleMarkers).toHaveBeenCalled();
		});

		test('handles external route selection events', () => {
			render(SearchPane, { props: mockProps });

			// Get the event listener that was registered
			const calls = vi.mocked(global.addEventListener).mock.calls;
			const routeEventListener = calls.find((call) => call[0] === 'routeSelectedFromModal')?.[1];

			expect(routeEventListener).toBeDefined();
		});
	});

	describe('Responsive Behavior', () => {
		test('applies responsive classes correctly', () => {
			const { container } = render(SearchPane, { props: mockProps });

			const modalPane = container.querySelector('.modal-pane');
			expect(modalPane).toHaveClass('md:w-96');
		});

		test('handles scrollable results container', async () => {
			const user = userEvent.setup();

			// Mock many results
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					stops: Array.from({ length: 20 }, (_, i) => ({
						id: `stop-${i}`,
						name: `Stop ${i}`,
						lat: 47.6062 + i * 0.001,
						lon: -122.3321 + i * 0.001,
						code: `1234${i}`,
						direction: 'N'
					})),
					query: 'Many Results'
				})
			});

			render(SearchPane, { props: mockProps });

			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'Many Results');
			await user.click(searchButton);

			await waitFor(() => {
				const resultsContainer = screen.getByText('Stop 0').closest('.max-h-96');
				expect(resultsContainer).toHaveClass('overflow-y-auto');
			});
		});
	});

	describe('Error Handling', () => {
		test('handles API errors gracefully during route selection', async () => {
			const user = userEvent.setup();
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Mock route search success, but stops-for-route failure
			global.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: vi.fn().mockResolvedValue({
						routes: [
							{
								id: 'route-44',
								nullSafeShortName: '44',
								description: 'University District Express',
								type: 3
							}
						],
						query: 'Route 44'
					})
				})
				.mockRejectedValueOnce(new Error('API Error'));

			render(SearchPane, { props: mockProps });

			const input = screen.getByRole('textbox');
			const searchButton = screen.getByRole('button');

			await user.type(input, 'Route 44');
			await user.click(searchButton);

			await waitFor(() => {
				expect(screen.getByText(/route 44/)).toBeInTheDocument();
			});

			const routeButton = screen.getByRole('button', { name: /route 44/ });
			await user.click(routeButton);

			// Should handle the error without crashing
			await waitFor(() => {
				expect(consoleSpy).toHaveBeenCalled();
			});

			consoleSpy.mockRestore();
		});
	});
});
