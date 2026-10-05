import { describe, it, expect, vi, afterEach } from 'vitest';
import { minInstant, earliestAfter, scheduleAt } from '$lib/onDemand/instants.js';

const at = (s) => Temporal.Instant.from(s);

describe('instants', () => {
	afterEach(() => vi.useRealTimers());

	it('minInstant ignores nulls', () => {
		expect(minInstant([null, at('2026-03-11T10:00Z'), at('2026-03-11T09:00Z')]).toString()).toBe(
			'2026-03-11T09:00:00Z'
		);
		expect(minInstant([null])).toBeNull();
	});

	it('earliestAfter skips instants at or before now', () => {
		const now = at('2026-03-11T10:00Z');
		expect(
			earliestAfter([now, at('2026-03-11T09:00Z'), at('2026-03-11T11:00Z')], now).toString()
		).toBe('2026-03-11T11:00:00Z');
		expect(earliestAfter([now], now)).toBeNull();
	});

	it('scheduleAt fires one second after the instant and can be cancelled', () => {
		vi.useFakeTimers();
		const callback = vi.fn();
		const nowMs = Date.now();
		const cancel = scheduleAt(
			Temporal.Instant.fromEpochMilliseconds(nowMs + 5_000),
			callback,
			nowMs
		);
		vi.advanceTimersByTime(5_999);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledTimes(1);
		cancel();
		const second = vi.fn();
		scheduleAt(null, second)();
		vi.runAllTimers();
		expect(second).not.toHaveBeenCalled();
	});
});
