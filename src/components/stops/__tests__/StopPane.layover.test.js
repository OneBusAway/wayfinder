// Integration coverage for layover collapsing in StopPane's arrival list.
// StopPane.test.js mocks the accordion wrappers, so it can never observe how
// many rows the list renders. Here the REAL SingleSelectAccordion and
// AccordionItem are used and only the row body (ArrivalDeparture) is mocked,
// so each rendered row shows up as one call to the mock with its arrival.
import { render, screen, waitFor } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import StopPane from '../StopPane.svelte';
import ArrivalDeparture from '$components/ArrivalDeparture.svelte';
import {
	mockStopData,
	mockArrivalsAndDeparturesResponse
} from '../../../tests/fixtures/obaData.js';

vi.mock('$components/ArrivalDeparture.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/oba/TripDetailsPane.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/surveys/SurveyModal.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/surveys/SurveyBanner.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/service-alerts/ServiceAlerts.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/LoadingSpinner.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$stores/surveyStore', () => ({
	surveyStore: {
		subscribe: vi.fn((fn) => {
			fn(null);
			return { unsubscribe: () => {} };
		})
	},
	showSurveyModal: { set: vi.fn() },
	markSurveyAnswered: vi.fn()
}));

vi.mock('$lib/Insights', () => ({
	default: { reportArrivalClicked: vi.fn() }
}));

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
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

global.fetch = vi.fn();

function responseWith(arrivalsAndDepartures) {
	return {
		...mockArrivalsAndDeparturesResponse,
		data: {
			...mockArrivalsAndDeparturesResponse.data,
			entry: { ...mockArrivalsAndDeparturesResponse.data.entry, arrivalsAndDepartures }
		}
	};
}

// Vehicle 1_4391 finishes trip A at this stop (its final stop) and then
// starts trip B here (first stop, next trip in its block).
function makeLayoverPair(now) {
	const base = mockArrivalsAndDeparturesResponse.data.entry.arrivalsAndDepartures[0];
	const arrival = {
		...base,
		tripId: '1_layover_arrival',
		tripHeadsign: 'Capitol Hill Via 15th Ave E',
		vehicleId: '1_4391',
		stopSequence: 20,
		totalStopsInTrip: 21,
		blockTripSequence: 5,
		predictedArrivalTime: now + 120000,
		scheduledArrivalTime: now + 120000
	};
	const departure = {
		...base,
		tripId: '1_layover_departure',
		tripHeadsign: 'Downtown Seattle',
		vehicleId: '1_4391',
		stopSequence: 0,
		totalStopsInTrip: 13,
		blockTripSequence: 6,
		predictedArrivalTime: now + 1080000,
		scheduledArrivalTime: now + 1080000
	};
	return { arrival, departure };
}

function renderedTripIds() {
	return ArrivalDeparture.mock.calls.map(([, props]) => props.arrivalDeparture.tripId);
}

describe('StopPane layover collapsing', () => {
	const defaultProps = { stop: mockStopData, handleUpdateRouteMap: vi.fn(), tripSelected: vi.fn() };

	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch.mockReset();
	});

	test('renders a single departure row for a laid-over vehicle', async () => {
		const { arrival, departure } = makeLayoverPair(Date.now());
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => responseWith([arrival, departure])
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
		});
		await waitFor(() => {
			expect(ArrivalDeparture).toHaveBeenCalled();
		});

		expect(renderedTripIds()).toEqual(['1_layover_departure']);
	});

	test('keeps both rows when the same vehicle returns on a later, non-adjoining trip', async () => {
		const { arrival, departure } = makeLayoverPair(Date.now());
		const laterVisit = { ...departure, tripId: '1_later_visit', blockTripSequence: 7 };
		global.fetch.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => responseWith([arrival, laterVisit])
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(ArrivalDeparture).toHaveBeenCalledTimes(2);
		});

		expect(renderedTripIds()).toEqual(['1_layover_arrival', '1_later_visit']);
	});

	test('collapses the layover in server-seeded data before the first client fetch', async () => {
		const { arrival, departure } = makeLayoverPair(Date.now());
		// Keep the client fetch pending so only the seeded response can render.
		global.fetch.mockImplementation(() => new Promise(() => {}));

		render(StopPane, {
			props: { ...defaultProps, arrivalsAndDeparturesResponse: responseWith([arrival, departure]) }
		});

		await waitFor(() => {
			expect(ArrivalDeparture).toHaveBeenCalled();
		});

		expect(renderedTripIds()).toEqual(['1_layover_departure']);
	});
});
