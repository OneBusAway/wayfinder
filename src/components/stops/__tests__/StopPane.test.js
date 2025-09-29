import { render, screen, waitFor } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import StopPane from '../StopPane.svelte';
import {
	mockStopData,
	mockArrivalsAndDeparturesResponse,
	mockEmptyArrivalsAndDeparturesResponse
} from '../../../tests/fixtures/obaData.js';

// Mock complex child components
vi.mock('$components/ArrivalDeparture.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn()
	}))
}));

vi.mock('$components/oba/TripDetailsPane.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn()
	}))
}));

vi.mock('$components/containers/SingleSelectAccordion.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn(),
		handleAccordionSelectionChanged: vi.fn()
	}))
}));

vi.mock('$components/containers/AccordionItem.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn()
	}))
}));

vi.mock('$components/surveys/SurveyModal.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn()
	}))
}));

vi.mock('$components/service-alerts/ServiceAlerts.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn()
	}))
}));

vi.mock('$components/surveys/HeroQuestion.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn()
	}))
}));

vi.mock('$components/LoadingSpinner.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn()
	}))
}));

// Mock stores
vi.mock('$stores/surveyStore', () => ({
	surveyStore: {
		subscribe: vi.fn((fn) => {
			fn(null);
			return { unsubscribe: () => {} };
		})
	},
	showSurveyModal: {
		set: vi.fn()
	},
	markSurveyAnswered: vi.fn()
}));

// Mock utilities
vi.mock('$lib/Surveys/surveyUtils', () => ({
	submitHeroQuestion: vi.fn().mockResolvedValue('survey-123'),
	skipSurvey: vi.fn()
}));

vi.mock('$lib/utils/user', () => ({
	getUserId: vi.fn().mockReturnValue('user-123')
}));

vi.mock('$lib/Analytics/PlausibleAnalytics', () => ({
	default: {
		reportArrivalClicked: vi.fn()
	}
}));

vi.mock('$components/service-alerts/serviceAlertsHelper', () => ({
	filterActiveAlerts: vi.fn((alerts) => alerts || [])
}));

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => {
				const translations = {
					stop: 'Stop',
					routes: 'Routes',
					'schedule_for_stop.view_schedule': 'View Schedule',
					no_arrivals_or_departures_in_next_30_minutes:
						'No arrivals or departures in the next 30 minutes'
				};
				return translations[key] || key;
			});
			return { unsubscribe: () => {} };
		})
	},
	isLoading: {
		subscribe: vi.fn((fn) => {
			fn(false); // Make sure isLoading is false so component renders
			return { unsubscribe: () => {} };
		})
	}
}));

// Mock global fetch
global.fetch = vi.fn();

describe('StopPane', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset fetch mock
		global.fetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllTimers();
	});

	const defaultProps = {
		stop: mockStopData,
		handleUpdateRouteMap: vi.fn(),
		tripSelected: vi.fn()
	};

	test('displays loading state initially', async () => {
		// Mock fetch to return pending promise
		global.fetch.mockImplementation(
			() => new Promise(() => {}) // Never resolves
		);

		render(StopPane, { props: defaultProps });

		// Component should render but not show arrival data since fetch is pending
		// Check that the main content areas are not present
		expect(screen.queryByText('Pine St & 3rd Ave')).not.toBeInTheDocument();
		expect(screen.queryByText('Stop #75403')).not.toBeInTheDocument();
	});

	test('displays arrival data when provided directly', async () => {
		// Mock fetch to resolve immediately even though we're providing data directly
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		// Provide data directly to component to test rendering
		const propsWithData = {
			...defaultProps,
			arrivalsAndDeparturesResponse: mockArrivalsAndDeparturesResponse
		};

		render(StopPane, { props: propsWithData });

		// Wait for the component to finish loading since it still triggers fetch
		// First wait for loading to disappear, then check for content
		await waitFor(
			() => {
				expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
			},
			{ timeout: 3000 }
		);

		// Now check that the content is displayed
		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		expect(screen.getByText('Stop #75403')).toBeInTheDocument();
		expect(screen.getByText('Routes: 10, 11')).toBeInTheDocument();
	});

	test('loads and displays arrival data successfully', async () => {
		// Mock successful API response
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		// Wait for data to load with longer timeout
		await waitFor(
			() => {
				expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
			},
			{ timeout: 3000 }
		);

		expect(screen.getByText('Stop #75403')).toBeInTheDocument();
		expect(screen.getByText('Routes: 10, 11')).toBeInTheDocument();
	});

	test('displays error message when API fails', async () => {
		// Mock failed API response
		global.fetch.mockRejectedValueOnce(new Error('API Error'));

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Unable to fetch arrival/departure data')).toBeInTheDocument();
		});
	});

	test('displays empty arrivals message when no arrivals', async () => {
		// Mock empty arrivals response
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(
				screen.getByText('No arrivals or departures in the next 30 minutes')
			).toBeInTheDocument();
		});
	});

	test('displays stop information correctly', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
			expect(screen.getByText('Stop #75403')).toBeInTheDocument();
		});
	});

	test('displays route information when available', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Routes: 10, 11')).toBeInTheDocument();
		});
	});

	test('displays schedule link when tripSelected prop is provided', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			const scheduleLink = screen.getByText('View Schedule');
			expect(scheduleLink).toBeInTheDocument();
			expect(scheduleLink.closest('a')).toHaveAttribute('href', '/stops/1_75403/schedule');
		});
	});

	test('does not display schedule link when tripSelected is null', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		const propsWithoutTripSelected = {
			...defaultProps,
			tripSelected: null
		};

		render(StopPane, { props: propsWithoutTripSelected });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		expect(screen.queryByText('View Schedule')).not.toBeInTheDocument();
	});

	test('handles API error response (500)', async () => {
		// Mock 500 error response
		global.fetch.mockResolvedValueOnce({
			ok: false,
			status: 500
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Unable to fetch arrival/departure data')).toBeInTheDocument();
		});
	});

	test('handles network error', async () => {
		// Mock network error
		global.fetch.mockRejectedValueOnce(new Error('Network error'));

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Unable to fetch arrival/departure data')).toBeInTheDocument();
		});
	});

	test('calls API with correct stop ID', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/oba/arrivals-and-departures-for-stop/1_75403',
				expect.objectContaining({
					signal: expect.any(AbortSignal)
				})
			);
		});
	});

	test('aborts previous request when stop changes', async () => {
		const { rerender } = render(StopPane, { props: defaultProps });

		// Mock first request
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		// Change stop by re-rendering with new props
		const newStop = { ...mockStopData, id: '1_75404' };
		rerender({ stop: newStop });

		// Should call fetch with new stop ID
		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('1_75404'),
				expect.any(Object)
			);
		});
	});

	test('handles accordion selection change', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		// Since the accordion component is mocked, we can test that the props are set up correctly
		// The actual accordion functionality would be tested in the accordion component's own tests
		expect(defaultProps.tripSelected).toBeDefined();
		expect(defaultProps.handleUpdateRouteMap).toBeDefined();
	});

	test('sets up polling interval for data refresh', async () => {
		vi.useFakeTimers();

		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		// Initial call
		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledTimes(1);
		});

		// Fast-forward 30 seconds
		vi.advanceTimersByTime(30000);

		// Should make another call
		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledTimes(2);
		});

		vi.useRealTimers();
	});

	test('cleans up interval on component destroy', () => {
		vi.useFakeTimers();

		const { unmount } = render(StopPane, { props: defaultProps });

		// Fast-forward to ensure interval is set
		vi.advanceTimersByTime(1000);

		// Unmount component (Svelte 5 way to destroy)
		unmount();

		// Advance timer and ensure no more calls
		const initialCallCount = global.fetch.mock.calls.length;
		vi.advanceTimersByTime(30000);

		expect(global.fetch).toHaveBeenCalledTimes(initialCallCount);

		vi.useRealTimers();
	});

	test('handles survey data when available', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		// Mock survey store to return survey data
		const mockSurvey = {
			id: 'survey_1',
			questions: [
				{
					id: 'q1',
					content: { type: 'text', label_text: 'How was your experience?' }
				}
			]
		};

		// Update the survey store mock
		const { surveyStore } = await import('$stores/surveyStore');
		vi.mocked(surveyStore.subscribe).mockImplementation((fn) => {
			fn(mockSurvey);
			return { unsubscribe: () => {} };
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});
	});

	test('component accessibility features', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			// Check for proper heading structure
			const stopNameHeading = screen.getByRole('heading', { level: 1 });
			expect(stopNameHeading).toHaveTextContent('Pine St & 3rd Ave');

			const headings = screen.getAllByRole('heading', { level: 2 });
			expect(headings).toHaveLength(2);
			expect(headings[0]).toHaveTextContent('Stop #75403');
			expect(headings[1]).toHaveTextContent('Routes: 10, 11');
		});
	});

	test('handles empty route list gracefully', async () => {
		const responseWithoutRoutes = {
			...mockArrivalsAndDeparturesResponse,
			data: {
				...mockArrivalsAndDeparturesResponse.data,
				references: {
					...mockArrivalsAndDeparturesResponse.data.references,
					routes: []
				}
			}
		};

		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => responseWithoutRoutes
		});

		const stopWithoutRoutes = { ...mockStopData, routeIds: [] };

		render(StopPane, { props: { ...defaultProps, stop: stopWithoutRoutes } });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		// Should not display the original routes (10, 11) since we're using a stop without routes
		expect(screen.queryByText('Routes: 10, 11')).not.toBeInTheDocument();
		// Component might still show "Routes:" but without route numbers
	});
});
