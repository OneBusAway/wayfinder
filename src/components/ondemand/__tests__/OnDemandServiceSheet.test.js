import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';

const fetchService = vi.hoisted(() => vi.fn());
vi.mock('$lib/onDemand/onDemandState.svelte.js', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, fetchService };
});

import OnDemandServiceSheet from '../OnDemandServiceSheet.svelte';
import { onDemandState, resetOnDemandStateForTesting } from '$lib/onDemand/onDemandState.svelte.js';
import { parseServiceEntry } from '$lib/onDemand/models.js';
import {
	entryBody,
	serviceJson,
	referencesJson,
	ruleJson,
	bookingRuleJson,
	square
} from '../../../tests/fixtures/onDemand.js';
import { createMockMapProvider } from '../../../tests/mocks/mapProviders.js';

const flush = async () => {
	for (let i = 0; i < 4; i++) {
		await tick();
		await Promise.resolve();
	}
};
const entry = (serviceOverrides = {}, refOverrides = {}) =>
	parseServiceEntry(entryBody(serviceJson(serviceOverrides), referencesJson(refOverrides)));

function setup(result) {
	fetchService.mockResolvedValue(result);
	const provider = createMockMapProvider();
	const closePane = vi.fn();
	const view = render(OnDemandServiceSheet, {
		serviceId: '5088_77652',
		closePane,
		mapProvider: provider
	});
	return { provider, closePane, ...view };
}

describe('OnDemandServiceSheet', () => {
	beforeEach(() => {
		resetOnDemandStateForTesting();
		fetchService.mockReset();
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		vi.setSystemTime(new Date('2026-03-10T23:59:00Z')); // 16:59 PDT, before the 17:00 cutoff
	});
	afterEach(() => vi.useRealTimers());

	it('loads simplified geometry, highlights the zone and frames it', async () => {
		const { provider } = setup(entry());
		await flush();
		expect(fetchService).toHaveBeenCalledWith('5088_77652', 'simplified');
		expect(onDemandState.highlighted?.id).toBe('5088_77652');
		expect(provider.fitToBounds).toHaveBeenCalledWith(
			{ west: -77.14, south: 38.79, east: -77.05, north: 38.84 },
			expect.anything()
		);
	});

	it('promotes the deadline for an advance service and offers a call', async () => {
		setup(entry());
		await flush();
		expect(screen.getByText('DASH On Demand')).toBeInTheDocument();
		expect(screen.getByText('ondemand.tag_advance')).toBeInTheDocument();
		expect(screen.getByTestId('ondemand-deadline')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'ondemand.call' })).toHaveAttribute(
			'href',
			'tel:703-746-5222'
		);
		expect(screen.getByText('Call to book your ride.')).toBeInTheDocument();
	});

	it('shows the status line, not the deadline row, for a real-time service', async () => {
		const realTime = bookingRuleJson({
			bookingType: 0,
			priorNoticeLastDay: null,
			priorNoticeLastTime: null,
			priorNoticeStartDay: null,
			priorNoticeStartTime: null,
			phoneNumber: null,
			bookingUrl: 'https://book.example'
		});
		setup(entry({}, { bookingRules: [realTime] }));
		await flush();
		expect(screen.queryByTestId('ondemand-deadline')).toBeNull();
		expect(screen.getByTestId('ondemand-status')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'ondemand.book_online' })).toHaveAttribute(
			'href',
			'https://book.example'
		);
	});

	it('shows Where only for zone-to-zone or multi-area services', async () => {
		setup(entry());
		await flush();
		expect(screen.queryByText('ondemand.where')).toBeNull();

		const refs = {
			serviceAreas: [
				...referencesJson().serviceAreas,
				{
					id: 'zone_b',
					name: 'Old Town',
					bbox: [-77.06, 38.8, -77.03, 38.82],
					geometry: square(-77.06, 38.8, -77.03, 38.82)
				}
			]
		};
		setup(entry({ rules: [ruleJson({ toIds: ['zone_b'] })] }, refs));
		await flush();
		expect(screen.getByText('ondemand.where')).toBeInTheDocument();
		expect(screen.getByText('Old Town')).toBeInTheDocument();
	});

	it('hides More information when it equals the service url', async () => {
		setup(
			entry({}, { bookingRules: [bookingRuleJson({ infoUrl: 'https://dashbus.com/ondemand' })] })
		);
		await flush();
		expect(screen.getByRole('link', { name: 'ondemand.open_agency_website' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'ondemand.more_information' })).toBeNull();
	});

	it('says the service is not available on a not-found', async () => {
		setup({ notFound: true });
		await flush();
		expect(screen.getByText('ondemand.not_available')).toBeInTheDocument();
	});

	it('offers a retry on failure', async () => {
		setup(null);
		await flush();
		fetchService.mockResolvedValue(entry());
		await userEvent
			.setup({ advanceTimers: vi.advanceTimersByTime })
			.click(screen.getByRole('button', { name: 'ondemand.retry' }));
		await flush();
		expect(screen.getByText('DASH On Demand')).toBeInTheDocument();
	});

	it('closes itself when the server turns out unsupported', async () => {
		fetchService.mockImplementation(async () => {
			onDemandState.support = 'unsupported';
			return null;
		});
		const provider = createMockMapProvider();
		const closePane = vi.fn();
		render(OnDemandServiceSheet, { serviceId: 'x', closePane, mapProvider: provider });
		await flush();
		expect(closePane).toHaveBeenCalled();
	});

	it('re-evaluates at the deadline without refetching', async () => {
		setup(entry());
		await flush();
		expect(screen.getByTestId('ondemand-deadline')).toBeInTheDocument();
		vi.advanceTimersByTime(2 * 60 * 1000); // past 17:00 PDT
		await flush();
		expect(fetchService).toHaveBeenCalledTimes(1);
		// Now booking is for the next service day (Thu); the deadline row still renders.
		expect(screen.getByTestId('ondemand-deadline').textContent).toContain(
			'ondemand.book_by_for_ride'
		);
	});

	it('clears the highlight when unmounted', async () => {
		const { unmount } = setup(entry());
		await flush();
		unmount();
		expect(onDemandState.highlighted).toBeNull();
	});

	it('ignores a load that resolves after unmount', async () => {
		let resolve;
		fetchService.mockReturnValue(new Promise((r) => (resolve = r)));
		const provider = createMockMapProvider();
		const { unmount } = render(OnDemandServiceSheet, {
			serviceId: '5088_77652',
			closePane: vi.fn(),
			mapProvider: provider
		});
		await flush();
		unmount();
		resolve(entry());
		await flush();
		expect(onDemandState.highlighted).toBeNull();
		expect(provider.fitToBounds).not.toHaveBeenCalled();
	});

	it('clears the previous highlight when switching to a not-found service', async () => {
		const { rerender } = setup(entry());
		await flush();
		expect(onDemandState.highlighted).not.toBeNull();
		fetchService.mockResolvedValue({ notFound: true });
		await rerender({ serviceId: 'other_1' });
		await flush();
		expect(fetchService).toHaveBeenLastCalledWith('other_1', 'simplified');
		expect(onDemandState.highlighted).toBeNull();
	});

	it('ignores a retried load that resolves after unmount', async () => {
		const { provider, unmount } = setup(null);
		await flush();
		let resolve;
		fetchService.mockReturnValue(new Promise((r) => (resolve = r)));
		await userEvent
			.setup({ advanceTimers: vi.advanceTimersByTime })
			.click(screen.getByRole('button', { name: 'ondemand.retry' }));
		await flush();
		unmount();
		resolve(entry());
		await flush();
		expect(onDemandState.highlighted).toBeNull();
		expect(provider.fitToBounds).not.toHaveBeenCalled();
	});
});
