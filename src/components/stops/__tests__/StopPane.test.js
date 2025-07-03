import { render, screen, waitFor } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach, afterAll } from 'vitest';
import StopPane from '../StopPane.svelte';
import {
	mockStopData,
	mockArrivalsAndDeparturesResponse,
	mockEmptyArrivalsAndDeparturesResponse
} from '../../../tests/fixtures/obaData.js';
import { server } from '../../../tests/setup/msw-server.js';

// Mock complex child components
vi.mock('$components/ArrivalDeparture.svelte', () => ({
	default: class MockArrivalDeparture {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('$components/oba/TripDetailsPane.svelte', () => ({
	default: class MockTripDetailsPane {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('$components/containers/SingleSelectAccordion.svelte', () => ({
	default: class MockAccordion {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('$components/containers/AccordionItem.svelte', () => ({
	default: class MockAccordionItem {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('$components/surveys/SurveyModal.svelte', () => ({
	default: class MockSurveyModal {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('$components/service-alerts/ServiceAlerts.svelte', () => ({
	default: class MockServiceAlerts {
		constructor(options) {
			this.options = options;
		}
	}
}));

vi.mock('$components/surveys/HeroQuestion.svelte', () => ({
	default: class MockHeroQuestion {
		constructor(options) {
			this.options = options;
		}
	}
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
			fn(false);
			return { unsubscribe: () => {} };
		})
	}
}));

// Mock global fetch
global.fetch = vi.fn();

describe('StopPane', () => {
	beforeEach(() => {
		server.listen({ onUnhandledRequest: 'warn' });
		vi.clearAllMocks();

		// Reset fetch mock
		global.fetch.mockReset();
	});

	afterEach(() => {
		server.resetHandlers();
		vi.clearAllTimers();
	});

	afterAll(() => {
		server.close();
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

		// Should show loading state
		await waitFor(
			() => {
				expect(document.body).toContainHTML('Loading...');
			},
			{ timeout: 1000 }
		);
	});

	test('loads and displays arrival data successfully', async () => {
		// Mock successful API response
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		render(StopPane, { props: defaultProps });

		// Wait for data to load
		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		expect(screen.getByText('Stop #1_75403')).toBeInTheDocument();
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
			expect(screen.getByText('Stop #1_75403')).toBeInTheDocument();
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
		const { component } = render(StopPane, { props: defaultProps });

		// Mock first request
		global.fetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => mockArrivalsAndDeparturesResponse
		});

		// Change stop
		const newStop = { ...mockStopData, id: '1_75404' };
		component.$set({ stop: newStop });

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

		const { component } = render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});

		// Simulate accordion selection change
		const mockArrivalData = mockArrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures[0];

		// Call the handler directly (since we're mocking the accordion)
		if (component.handleAccordionSelectionChanged) {
			component.handleAccordionSelectionChanged({ activeData: mockArrivalData });
		}

		expect(defaultProps.tripSelected).toHaveBeenCalledWith({ detail: mockArrivalData });
		expect(defaultProps.handleUpdateRouteMap).toHaveBeenCalledWith({ detail: { show: true } });
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

		const { component } = render(StopPane, { props: defaultProps });

		// Fast-forward to ensure interval is set
		vi.advanceTimersByTime(1000);

		// Destroy component
		component.$destroy();

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
		vi.mocked(require('$stores/surveyStore').surveyStore.subscribe).mockImplementation((fn) => {
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

			const stopIdHeading = screen.getByRole('heading', { level: 2 });
			expect(stopIdHeading).toHaveTextContent('Stop #1_75403');
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

		// Should not display routes section
		expect(screen.queryByText(/Routes:/)).not.toBeInTheDocument();
	});
});
