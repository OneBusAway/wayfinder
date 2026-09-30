import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';

const fetchService = vi.hoisted(() => vi.fn());
vi.mock('$lib/onDemand/onDemandState.svelte.js', async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, fetchService };
});

import OnDemandStopCard from '../OnDemandStopCard.svelte';
import { onDemandState, resetOnDemandStateForTesting } from '$lib/onDemand/onDemandState.svelte.js';
import { parseServiceEntry } from '$lib/onDemand/models.js';
import { entryBody, serviceJson } from '../../../tests/fixtures/onDemand.js';

const entry = (overrides) => parseServiceEntry(entryBody(serviceJson(overrides)));
const flush = async () => {
	for (let i = 0; i < 3; i++) {
		await tick();
		await Promise.resolve();
	}
};

describe('OnDemandStopCard', () => {
	beforeEach(() => {
		resetOnDemandStateForTesting();
		fetchService.mockReset();
	});

	it('renders nothing for a stop without on-demand ids', async () => {
		const { container } = render(OnDemandStopCard, { stop: { id: '1_1' } });
		await flush();
		expect(fetchService).not.toHaveBeenCalled();
		expect(container.textContent.trim()).toBe('');
	});

	it('lists each loaded service with a link to its sheet and a call link', async () => {
		fetchService.mockResolvedValue(entry());
		render(OnDemandStopCard, { stop: { id: '1_1', onDemandServiceIds: ['5088_77652'] } });
		await flush();
		expect(fetchService).toHaveBeenCalledWith('5088_77652', 'none');
		expect(screen.getByText('ondemand.card_title')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /DASH On Demand/ })).toHaveAttribute(
			'href',
			'/map/ondemand/5088_77652'
		);
		expect(document.querySelector('a[href="tel:703-746-5222"]')).not.toBeNull();
	});

	it('drops failed services and hides when none load', async () => {
		fetchService.mockResolvedValueOnce(null).mockResolvedValueOnce({ notFound: true });
		const { container } = render(OnDemandStopCard, {
			stop: { id: '1_1', onDemandServiceIds: ['a', 'b'] }
		});
		await flush();
		expect(container.textContent.trim()).toBe('');
	});

	it('does not refetch when the stop object is replaced with the same ids', async () => {
		fetchService.mockResolvedValue(entry());
		const { rerender } = render(OnDemandStopCard, {
			stop: { id: '1_1', onDemandServiceIds: ['5088_77652'] }
		});
		await flush();
		await rerender({ stop: { id: '1_1', onDemandServiceIds: ['5088_77652'] } });
		await flush();
		expect(fetchService).toHaveBeenCalledTimes(1);
	});

	it('hides when the server is unsupported', async () => {
		onDemandState.support = 'unsupported';
		const { container } = render(OnDemandStopCard, {
			stop: { id: '1_1', onDemandServiceIds: ['x'] }
		});
		await flush();
		expect(fetchService).not.toHaveBeenCalled();
		expect(container.textContent.trim()).toBe('');
	});

	it('hands the click to onSelectService when provided', async () => {
		fetchService.mockResolvedValue(entry());
		const onSelectService = vi.fn();
		render(OnDemandStopCard, {
			stop: { id: '1_1', onDemandServiceIds: ['5088_77652'] },
			onSelectService
		});
		await flush();
		await userEvent.click(screen.getByRole('link', { name: /DASH On Demand/ }));
		expect(onSelectService).toHaveBeenCalledWith('5088_77652');
	});
});
