// Integration coverage for layover collapsing in StopPane's arrival list.
// StopPane.test.js mocks the accordion wrappers, so it can never observe how
// many rows the list renders. Here the REAL SingleSelectAccordion and
// AccordionItem are used; the row body (ArrivalDeparture) and the unrelated
// panes are stubbed, so each rendered row shows up as one call to the
// ArrivalDeparture mock with its arrival.
import { render, waitFor } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import StopPane from '../StopPane.svelte';
import ArrivalDeparture from '$components/ArrivalDeparture.svelte';
import {
	mockStopData,
	mockArrivalsAndDeparturesResponse
} from '../../../tests/fixtures/obaData.js';

const stubComponent = vi.hoisted(() => () => ({
	default: vi.fn(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/ArrivalDeparture.svelte', stubComponent);
vi.mock('$components/oba/TripDetailsPane.svelte', stubComponent);
vi.mock('$components/surveys/SurveyModal.svelte', stubComponent);
vi.mock('$components/surveys/SurveyBanner.svelte', stubComponent);
vi.mock('$components/service-alerts/ServiceAlerts.svelte', stubComponent);

vi.mock('$stores/surveyStore', async () => {
	const { createMockStore } = await import('../../../tests/helpers/test-utils.js');
	return {
		surveyStore: createMockStore(null),
		showSurveyModal: { set: vi.fn() },
		markSurveyAnswered: vi.fn()
	};
});

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
			json: async () => responseWith([arrival, departure])
		});

		render(StopPane, { props: defaultProps });

		await waitFor(() => {
			expect(ArrivalDeparture).toHaveBeenCalledTimes(1);
		});

		expect(renderedTripIds()).toEqual(['1_layover_departure']);
	});

	test('keeps both rows when the same vehicle returns on a later, non-adjoining trip', async () => {
		const { arrival, departure } = makeLayoverPair(Date.now());
		const laterVisit = { ...departure, tripId: '1_later_visit', blockTripSequence: 7 };
		global.fetch.mockResolvedValue({
			ok: true,
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
			expect(ArrivalDeparture).toHaveBeenCalledTimes(1);
		});

		expect(renderedTripIds()).toEqual(['1_layover_departure']);
	});
});
