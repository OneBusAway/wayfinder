import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import StopPane from '../StopPane.svelte';
import {
	mockStopData,
	mockArrivalsAndDeparturesResponse,
	mockEmptyArrivalsAndDeparturesResponse
} from '../../../tests/fixtures/obaData.js';
import { env } from '$env/dynamic/public';

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

// Stub card: sets its bound `services` only when a test opts in via onDemandStub.
const onDemandStub = vi.hoisted(() => ({ services: [] }));
vi.mock('$components/stops/OnDemandStopCard.svelte', () => ({
	default: vi.fn((anchor, props) => {
		props.services = onDemandStub.services;
	})
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

vi.mock('$components/surveys/SurveyBanner.svelte', () => ({
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

vi.mock('$lib/Insights', () => ({
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
			fn((key, options) => {
				const translations = {
					stop: 'Stop',
					routes: 'Routes',
					arrivals_and_departures: 'Arrivals and departures',
					'schedule_for_stop.view_schedule': 'View Schedule',
					load_more_arrivals: 'Load more arrivals',
					loading: 'Loading...',
					no_arrivals_found_in_next_minutes: 'No arrivals found in the next {minutes} minutes',
					no_arrivals_found_in_next_hours:
						options?.values?.hours === 1
							? 'No arrivals found in the next 1 hour'
							: 'No arrivals found in the next {hours} hours',
					no_more_arrivals_in_next_minutes: 'No more arrivals in the next {minutes} minutes',
					no_more_arrivals_in_next_hours:
						options?.values?.hours === 1
							? 'No more arrivals in the next 1 hour'
							: 'No more arrivals in the next {hours} hours'
				};
				let str = translations[key] || key;
				if (options?.values) {
					for (const [name, value] of Object.entries(options.values)) {
						str = str.replace(`{${name}}`, value);
					}
				}
				return str;
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
		onDemandStub.services = [];

		// Reset fetch mock
		global.fetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllTimers();
		delete env.PUBLIC_OBA_AUTO_EXTEND_MAX_MINUTES;
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

	test('displays empty arrivals message when no arrivals after auto-extending', async () => {
		// Mock empty arrivals response for all auto-extension attempts
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();
		});

		expect(global.fetch).toHaveBeenCalledTimes(9);
		const button = screen.getByRole('button', { name: 'Load more arrivals' });
		expect(button).toBeEnabled();
	});

	test('tells riders at a flex-only stop that on-demand service is available', async () => {
		onDemandStub.services = [{ id: 'x' }];
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: { ...defaultProps, stop: { ...mockStopData, routeIds: [] } } });

		await waitFor(() => {
			expect(screen.getByText('ondemand.flex_only_empty_arrivals')).toBeInTheDocument();
		});
		expect(screen.queryByText(/No arrivals found in the next/)).not.toBeInTheDocument();
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	test('keeps the time-window empty message at a stop with routes and on-demand service', async () => {
		onDemandStub.services = [{ id: 'x' }];
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();
		});
		expect(screen.queryByText('ondemand.flex_only_empty_arrivals')).not.toBeInTheDocument();
		expect(global.fetch).toHaveBeenCalledTimes(9);
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

	test('does not render an "Arrivals and departures" section header', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: { stop: mockStopData } });
		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalled();
		});

		expect(screen.queryByText('Arrivals and departures')).not.toBeInTheDocument();
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
				'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=35',
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

		// Initial call - wait for data to load and interval to be scheduled
		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
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

	test('shows "No more arrivals" message when load-more returns no new results', async () => {
		// First call returns arrivals
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		// Second call (load-more) returns the same data (no new arrivals)
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		await userEvent.click(screen.getByText('Load more arrivals'));

		await waitFor(() => {
			expect(screen.getByText('No more arrivals in the next 65 minutes')).toBeInTheDocument();
		});
	});

	test('does not show "No more arrivals" when load-more surfaces a later arrival', async () => {
		// Initial window returns the base arrivals.
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		// Widened window: the front arrival has departed but a genuinely later
		// arrival appears, so the count is unchanged while more remains to show.
		const base = mockArrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures;
		const widenedResponse = {
			...mockArrivalsAndDeparturesResponse,
			data: {
				...mockArrivalsAndDeparturesResponse.data,
				entry: {
					...mockArrivalsAndDeparturesResponse.data.entry,
					arrivalsAndDepartures: [
						...base.slice(1),
						{
							...base[0],
							tripId: '1_later_trip',
							predictedArrivalTime: null,
							scheduledArrivalTime: Date.now() + 3600000 // 60 minutes from now
						}
					]
				}
			}
		};
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => widenedResponse
		});

		await userEvent.click(screen.getByText('Load more arrivals'));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=65',
				expect.any(Object)
			);
		});

		// Wait for the widened response to finish processing: the button only
		// returns from its loading state after loadMoreArrivals resolves and
		// recomputes the hint in the same tick (the arrival list itself renders
		// through mocked children, so it exposes no DOM value to wait on).
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Load more arrivals' })).toBeEnabled();
		});

		expect(screen.queryByText('No more arrivals in the next 65 minutes')).not.toBeInTheDocument();
	});

	test('calls API with incremented minutesAfter on load-more click', async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		await userEvent.click(screen.getByText('Load more arrivals'));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith(
				'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=65',
				expect.objectContaining({
					signal: expect.any(AbortSignal)
				})
			);
		});
	});

	test('shows "No arrivals found" for truly empty stop after auto-extending', async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();
		});

		expect(global.fetch).toHaveBeenCalledTimes(9);
		expect(screen.getByRole('button', { name: 'Load more arrivals' })).toBeEnabled();
	});

	test('auto-extends arrivals window on initial load until departures are found', async () => {
		// First call (35 min) returns empty arrivals
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});
		// Second call (95 min) returns arrivals
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		expect(global.fetch).toHaveBeenNthCalledWith(
			1,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=35',
			expect.any(Object)
		);
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=95',
			expect.any(Object)
		);
		expect(screen.queryByText(/No arrivals found in the next/)).not.toBeInTheDocument();
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

	test('progressively widens minutesAfter across multiple empty increments until arrivals found', async () => {
		// First call (35 min) returns empty arrivals
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});
		// Second call (95 min) returns empty arrivals
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});
		// Third call (155 min) returns arrivals
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		expect(global.fetch).toHaveBeenNthCalledWith(
			1,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=35',
			expect.any(Object)
		);
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=95',
			expect.any(Object)
		);
		expect(global.fetch).toHaveBeenNthCalledWith(
			3,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=155',
			expect.any(Object)
		);
		expect(screen.queryByText(/No arrivals found in the next/)).not.toBeInTheDocument();
	});

	test('keeps stop header and info visible when initialized with empty SSR seed', async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, {
			props: {
				...defaultProps,
				arrivalsAndDeparturesResponse: mockEmptyArrivalsAndDeparturesResponse
			}
		});

		// The stop name and stop number must be visible immediately from the SSR seed
		expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		expect(screen.getByText('Stop #75403')).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();
		});

		// Header remains visible after auto-extension finishes
		expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
	});

	test('handles error mid-extension without blanking header or leaking unvalidated window', async () => {
		// 35 min succeeds with empty
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});
		// 95 min succeeds with empty
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});
		// 155 min rejects with network error
		global.fetch.mockRejectedValueOnce(new Error('Network error'));

		render(StopPane, {
			props: {
				...defaultProps,
				arrivalsAndDeparturesResponse: mockEmptyArrivalsAndDeparturesResponse
			}
		});

		await waitFor(() => {
			expect(screen.getByText('Unable to fetch arrival/departure data')).toBeInTheDocument();
		});

		// Stop header remains visible even after fetch failure
		expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();

		// Verify fetch attempted 35, 95, 155
		expect(global.fetch).toHaveBeenCalledTimes(3);
		expect(global.fetch).toHaveBeenNthCalledWith(
			1,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=35',
			expect.any(Object)
		);
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=95',
			expect.any(Object)
		);
		expect(global.fetch).toHaveBeenNthCalledWith(
			3,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=155',
			expect.any(Object)
		);
	});

	test('load-more click does not auto-extend even during initial load', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, {
			props: {
				...defaultProps,
				arrivalsAndDeparturesResponse: mockArrivalsAndDeparturesResponse
			}
		});

		const loadMoreBtn = await screen.findByRole('button', { name: 'Load more arrivals' });

		// Click load more: should make a single request for 35 + 30 = 65 minutes
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		await userEvent.click(loadMoreBtn);

		await waitFor(() => {
			expect(global.fetch).toHaveBeenLastCalledWith(
				'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=65',
				expect.any(Object)
			);
		});

		// Exactly 2 fetches total: 1 initial effect, 1 load-more (no auto-extension loop!)
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	test('periodic background polling decays back to default 35-minute window after exhaustion', async () => {
		vi.useFakeTimers();

		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		// Wait for the 9 initial auto-extension fetches to complete
		await vi.waitFor(() => {
			expect(global.fetch).toHaveBeenCalledTimes(9);
		});

		expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();

		// Advance timer by 30 seconds for background poll
		await vi.advanceTimersByTimeAsync(30000);

		// 10th fetch should be the 30s background poll, requesting 35 minutes (not 720!)
		expect(global.fetch).toHaveBeenCalledTimes(10);
		expect(global.fetch).toHaveBeenNthCalledWith(
			10,
			'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=35',
			expect.any(Object)
		);

		// The rider still sees the 12-hour empty message
		expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();

		vi.useRealTimers();
	});

	test('respects configured PUBLIC_OBA_AUTO_EXTEND_MAX_MINUTES environment variable', async () => {
		env.PUBLIC_OBA_AUTO_EXTEND_MAX_MINUTES = '155';

		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 155 minutes')).toBeInTheDocument();
		});

		// Exactly 3 calls: 35, 95, 155
		expect(global.fetch).toHaveBeenCalledTimes(3);
		// Manual load-more remains enabled and unbounded
		expect(screen.getByRole('button', { name: 'Load more arrivals' })).toBeEnabled();
	});

	test('falls back to default 720 minutes when PUBLIC_OBA_AUTO_EXTEND_MAX_MINUTES is non-integer, decimal, or invalid', async () => {
		for (const invalidValue of ['100.5', 'Infinity', '-50', 'not-a-number']) {
			env.PUBLIC_OBA_AUTO_EXTEND_MAX_MINUTES = invalidValue;

			global.fetch.mockReset();
			global.fetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => mockEmptyArrivalsAndDeparturesResponse
			});

			const { unmount } = render(StopPane, { props: defaultProps });

			await waitFor(() => {
				expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();
			});

			expect(global.fetch).toHaveBeenCalledTimes(9);
			unmount();
		}
	});

	test('clamps PUBLIC_OBA_AUTO_EXTEND_MAX_MINUTES to default 720 minutes at runtime when value exceeds ceiling', async () => {
		env.PUBLIC_OBA_AUTO_EXTEND_MAX_MINUTES = '100000';

		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();
		});

		// Clamped at 720, so exactly 9 calls, not 800+ calls
		expect(global.fetch).toHaveBeenCalledTimes(9);
	});

	test('preserves extended window on consecutive load-more clicks even after empty results', async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, {
			props: {
				...defaultProps,
				arrivalsAndDeparturesResponse: mockArrivalsAndDeparturesResponse
			}
		});

		const loadMoreBtn = await screen.findByRole('button', { name: 'Load more arrivals' });

		// First load more click: 35 + 30 = 65 minutes, returns empty arrivals
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		await userEvent.click(loadMoreBtn);

		await waitFor(() => {
			expect(global.fetch).toHaveBeenLastCalledWith(
				'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=65',
				expect.any(Object)
			);
		});

		// Button should NOT be disabled after loading completes because 65 < 720
		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Load more arrivals' })).not.toBeDisabled();
		});

		// Second load more click: 65 + 30 = 95 minutes, preserves window without resetting to 35
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		const secondLoadMoreBtn = screen.getByRole('button', { name: 'Load more arrivals' });
		await userEvent.click(secondLoadMoreBtn);

		await waitFor(() => {
			expect(global.fetch).toHaveBeenLastCalledWith(
				'/api/oba/arrivals-and-departures-for-stop/1_75403?minutesAfter=95',
				expect.any(Object)
			);
		});

		// Exactly 3 fetches total: 1 initial effect, 1 load-more (65), 1 load-more (95)
		expect(global.fetch).toHaveBeenCalledTimes(3);
	});

	test('polling interval does not interrupt or reset in-flight auto-extension loop', async () => {
		vi.useFakeTimers();

		let resolveSecondFetch;
		const secondFetchPromise = new Promise((resolve) => {
			resolveSecondFetch = resolve;
		});

		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockEmptyArrivalsAndDeparturesResponse
			})
			.mockImplementationOnce(() => secondFetchPromise)
			.mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => mockEmptyArrivalsAndDeparturesResponse
			});

		render(StopPane, { props: defaultProps });

		// Initial call (35 min) finishes, second call (95 min) is now in flight
		await vi.waitFor(() => {
			expect(global.fetch).toHaveBeenCalledTimes(2);
		});
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining('minutesAfter=95'),
			expect.any(Object)
		);

		// Advance timer by 30 seconds while second fetch is in flight
		await vi.advanceTimersByTimeAsync(30000);

		// Polling should NOT have fired or aborted the second fetch
		expect(global.fetch).toHaveBeenCalledTimes(2);

		// Now resolve second fetch
		resolveSecondFetch({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		// Auto-extension should continue to widen through the rest of the steps up to 720
		await vi.waitFor(() => {
			expect(global.fetch).toHaveBeenCalledTimes(9);
		});
		expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();

		vi.useRealTimers();
	});

	test('switching stops clears previous arrivals immediately and does not show them during auto-extension', async () => {
		// First render Stop A with arrivals
		const { rerender } = render(StopPane, {
			props: {
				...defaultProps,
				stop: mockStopData,
				arrivalsAndDeparturesResponse: mockArrivalsAndDeparturesResponse
			}
		});

		expect(screen.getByText('Stop #75403')).toBeInTheDocument();

		// Setup fetch for Stop B to return empty arrivals
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				code: 200,
				text: 'OK',
				data: {
					entry: {
						stopId: '1_75404',
						arrivalsAndDepartures: []
					},
					references: { situations: [] }
				}
			})
		});

		// Switch to Stop B
		const newStop = { ...mockStopData, id: '1_75404', name: 'Stop B' };
		await rerender({ stop: newStop });

		// Previous stop info from Stop A must be cleared
		await waitFor(() => {
			expect(screen.queryByText('Stop #75403')).not.toBeInTheDocument();
		});

		// After auto-extension completes for Stop B, empty message for Stop B appears
		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();
		});
	});

	test('renders singular hour string when auto-extension window is 60 minutes', async () => {
		env.PUBLIC_OBA_AUTO_EXTEND_MAX_MINUTES = '60';

		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 1 hour')).toBeInTheDocument();
		});
		expect(screen.queryByText('No arrivals found in the next 1 hours')).not.toBeInTheDocument();
	});

	test('resets noMoreArrivalsBoundary on stop change and when auto-extend reaches cap', async () => {
		// Mock empty arrivals so auto-extend hits the cap
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});

		const { rerender } = render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('No arrivals found in the next 12 hours')).toBeInTheDocument();
		});

		// Now simulate a stop change with arrivals
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		const newStop = { ...mockStopData, id: '1_75404' };
		await rerender({ stop: newStop });

		await waitFor(() => {
			expect(screen.getByText('Stop #75404')).toBeInTheDocument();
			expect(screen.queryByText(/No arrivals found in the next/)).not.toBeInTheDocument();
		});
		expect(screen.queryByText(/No more arrivals in the next/)).not.toBeInTheDocument();
	});

	test('background polling retries auto-extension if earlier auto-extend failed mid-way', async () => {
		vi.useFakeTimers();

		// First call succeeds with 0 arrivals (35m)
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockEmptyArrivalsAndDeparturesResponse
		});
		// Second call fails with network error mid-extension
		global.fetch.mockRejectedValueOnce(new Error('Network error'));

		render(StopPane, { props: defaultProps });

		// Wait for initial failure to settle
		await waitFor(() => {
			expect(screen.getByText('Unable to fetch arrival/departure data')).toBeInTheDocument();
		});

		// Now mock recovery: first call empty (35m), then second call finds arrivals (95m)
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockEmptyArrivalsAndDeparturesResponse
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockArrivalsAndDeparturesResponse
			});

		// Advance 30 seconds to trigger background poll
		await vi.advanceTimersByTimeAsync(30000);

		// The background poll retried auto-extension and successfully cleared the error
		await waitFor(() => {
			expect(screen.queryByText('Unable to fetch arrival/departure data')).not.toBeInTheDocument();
			expect(screen.queryByText(/No arrivals found in the next/)).not.toBeInTheDocument();
		});

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('minutesAfter=95'),
			expect.any(Object)
		);

		vi.useRealTimers();
	});

	test('manual refresh restarts fetch and allows auto-extension on empty stop', async () => {
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockEmptyArrivalsAndDeparturesResponse
			})
			.mockRejectedValueOnce(new Error('Network error'));

		const { component } = render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Unable to fetch arrival/departure data')).toBeInTheDocument();
		});

		// When user triggers manual refresh, auto-extension is allowed again
		global.fetch
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockEmptyArrivalsAndDeparturesResponse
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => mockArrivalsAndDeparturesResponse
			});

		component.refresh();

		await waitFor(() => {
			expect(screen.queryByText('Unable to fetch arrival/departure data')).not.toBeInTheDocument();
		});

		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining('minutesAfter=95'),
			expect.any(Object)
		);
	});
});
