// Integration coverage for layover collapsing in StopPane's arrival list.
// StopPane.test.js mocks the accordion wrappers, so it can never observe how
// many rows the list renders. Here the REAL SingleSelectAccordion and
// AccordionItem are used; the row body (ArrivalDeparture) and the unrelated
// panes are stubbed, so each rendered row shows up as one call to the
// ArrivalDeparture mock with its arrival.
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import StopPane from '../StopPane.svelte';
import analytics from '$lib/Insights';
import { tick } from 'svelte';
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
vi.mock('$components/stops/OnDemandStopCard.svelte', stubComponent);

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

	test('forwards the selected arrival to the map and clears it on toggle-off', async () => {
		const { departure } = makeLayoverPair(Date.now());
		global.fetch.mockImplementation(() => new Promise(() => {}));
		const tripSelected = vi.fn();
		const handleUpdateRouteMap = vi.fn();
		const { container } = render(StopPane, {
			props: {
				stop: mockStopData,
				tripSelected,
				handleUpdateRouteMap,
				arrivalsAndDeparturesResponse: responseWith([departure])
			}
		});

		const button = container.querySelector('button[aria-expanded]');
		await fireEvent.click(button);
		expect(tripSelected).toHaveBeenLastCalledWith({ detail: departure });
		expect(handleUpdateRouteMap).toHaveBeenLastCalledWith({ detail: { show: true } });
		await fireEvent.click(button);
		expect(tripSelected).toHaveBeenLastCalledWith({ detail: null });
		expect(handleUpdateRouteMap).toHaveBeenLastCalledWith({ detail: { show: false } });
	});

	test.each(['manual', 'poll'])(
		'keeps the selected trip and route visible after a completed %s refresh',
		async (refreshType) => {
			const { departure } = makeLayoverPair(Date.now());
			const refreshedDeparture = {
				...departure,
				predictedArrivalTime: departure.predictedArrivalTime + 60000
			};
			global.fetch
				.mockResolvedValueOnce({ ok: true, json: async () => responseWith([departure]) })
				.mockResolvedValueOnce({ ok: true, json: async () => responseWith([refreshedDeparture]) });
			const tripSelected = vi.fn();
			const handleUpdateRouteMap = vi.fn();
			const intervalSpy = vi.spyOn(global, 'setInterval');
			const { container, component } = render(StopPane, {
				props: { stop: mockStopData, tripSelected, handleUpdateRouteMap }
			});

			try {
				await waitFor(() => expect(ArrivalDeparture).toHaveBeenCalledTimes(1));
				await tick();
				const button = container.querySelector('button[aria-expanded]');
				await fireEvent.click(button);
				expect(button).toHaveAttribute('aria-expanded', 'true');
				expect(tripSelected).toHaveBeenLastCalledWith({ detail: departure });
				expect(handleUpdateRouteMap).toHaveBeenLastCalledWith({ detail: { show: true } });
				const selectionCalls = tripSelected.mock.calls.length;
				const routeCalls = handleUpdateRouteMap.mock.calls.length;
				const analyticsCalls = analytics.reportArrivalClicked.mock.calls.length;

				if (refreshType === 'manual') {
					component.refresh();
				} else {
					const [poll] = intervalSpy.mock.calls.find(([, delay]) => delay === 30000);
					poll();
				}

				// Wait for the new arrival object to reach the row, proving that the
				// refresh completed and replaced the previous reactive response.
				await waitFor(() => {
					expect(ArrivalDeparture.mock.lastCall[1].arrivalDeparture).toEqual(refreshedDeparture);
				});
				await tick();
				expect(global.fetch).toHaveBeenCalledTimes(2);
				expect(button).toHaveAttribute('aria-expanded', 'true');
				expect(tripSelected).toHaveBeenCalledTimes(selectionCalls);
				expect(tripSelected).toHaveBeenLastCalledWith({ detail: departure });
				expect(handleUpdateRouteMap).toHaveBeenCalledTimes(routeCalls);
				expect(handleUpdateRouteMap).toHaveBeenLastCalledWith({ detail: { show: true } });
				expect(analytics.reportArrivalClicked).toHaveBeenCalledTimes(analyticsCalls);

				await fireEvent.click(button);
				expect(button).toHaveAttribute('aria-expanded', 'false');
				expect(tripSelected).toHaveBeenLastCalledWith({ detail: null });
				expect(handleUpdateRouteMap).toHaveBeenLastCalledWith({ detail: { show: false } });
			} finally {
				intervalSpy.mockRestore();
			}
		}
	);

	test('does not report an arrival click when an unselected list refreshes', async () => {
		const { departure } = makeLayoverPair(Date.now());
		const refreshedDeparture = {
			...departure,
			predictedArrivalTime: departure.predictedArrivalTime + 60000
		};
		global.fetch
			.mockResolvedValueOnce({ ok: true, json: async () => responseWith([departure]) })
			.mockResolvedValueOnce({ ok: true, json: async () => responseWith([refreshedDeparture]) });
		const { container, component } = render(StopPane, { props: defaultProps });
		await waitFor(() => expect(ArrivalDeparture).toHaveBeenCalledTimes(1));
		await tick();
		const analyticsCalls = analytics.reportArrivalClicked.mock.calls.length;

		component.refresh();
		await waitFor(() => {
			expect(ArrivalDeparture.mock.lastCall[1].arrivalDeparture).toEqual(refreshedDeparture);
		});
		await tick();
		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(container.querySelector('button[aria-expanded]')).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		expect(analytics.reportArrivalClicked).toHaveBeenCalledTimes(analyticsCalls);
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
