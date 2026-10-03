import { describe, it, expect } from 'vitest';
import vectors from '../../fixtures/flex-booking-vectors.json';
import { createEvaluator, parseGtfsTime, LOOKAHEAD_DAYS } from '$lib/onDemand/bookingDeadline.js';

const instantOrNull = (value) => (value ? Temporal.Instant.from(value) : null);
const sameInstant = (actual, expected) =>
	expected == null ? actual === null : actual !== null && actual.equals(expected);

describe('booking-deadline vectors (mirrors maglev testdata/flex-booking-vectors.json)', () => {
	it('has all 22 vectors', () => {
		expect(vectors.vectors).toHaveLength(22);
	});

	for (const vector of vectors.vectors) {
		it(vector.name, () => {
			const evaluator = createEvaluator(vector.timezone ?? vectors.timezone, vectors.calendars);
			const now = Temporal.Instant.from(vector.now);
			const travelDate = Temporal.PlainDate.from(vector.travelDate);
			const result = evaluator.evaluate(vector.rule, vector.bookingRule, travelDate, now);

			expect(result.state).toBe(vector.expected.state);
			expect(sameInstant(result.cutoffInstant, instantOrNull(vector.expected.cutoffInstant))).toBe(
				true
			);
			expect(sameInstant(result.openInstant, instantOrNull(vector.expected.openInstant))).toBe(
				true
			);
			const next = evaluator.nextBookableServiceDate(vector.rule, vector.bookingRule, now);
			expect(next?.toString() ?? null).toBe(vector.expected.nextBookableServiceDate);
		});
	}
});

describe('parseGtfsTime', () => {
	it('parses times past 24:00 and rejects junk', () => {
		expect(parseGtfsTime('24:50:00')).toBe(89400);
		expect(parseGtfsTime('7:05:09')).toBe(25509);
		expect(parseGtfsTime(null)).toBeNull();
		expect(parseGtfsTime('noon')).toBeNull();
	});
});

describe('countBack', () => {
	const weekdays = {
		id: 'wk',
		days: ['mon', 'tue', 'wed', 'thu', 'fri'],
		startDate: '2026-01-01',
		endDate: '2026-12-31',
		exceptedDates: []
	};
	const date = (s) => Temporal.PlainDate.from(s);

	it('returns the date itself for zero', () => {
		const evaluator = createEvaluator('America/Detroit', [weekdays]);
		expect(evaluator.countBack(date('2026-03-16'), 0, 'wk').toString()).toBe('2026-03-16');
	});

	it('counts civil days with no calendar, or a calendar references do not carry', () => {
		const evaluator = createEvaluator('America/Detroit', [weekdays]);
		expect(evaluator.countBack(date('2026-03-16'), 2, null).toString()).toBe('2026-03-14');
		expect(evaluator.countBack(date('2026-03-16'), 2, 'absent').toString()).toBe('2026-03-14');
	});

	it('is null for an unparseable startDate or a calendar with no days', () => {
		const evaluator = createEvaluator('America/Detroit', [
			{ ...weekdays, id: 'bad', startDate: 'soon' },
			{ ...weekdays, id: 'empty', days: [] }
		]);
		expect(evaluator.countBack(date('2026-03-16'), 1, 'bad')).toBeNull();
		expect(evaluator.countBack(date('2026-03-16'), 1, 'empty')).toBeNull();
	});

	it('succeeds on exactly the 400th day back and fails beyond it', () => {
		const evaluator = createEvaluator('America/Detroit', [
			{
				id: 'every',
				days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
				startDate: '2020-01-01',
				endDate: '2030-01-01',
				exceptedDates: []
			}
		]);
		const travel = date('2026-03-16');
		expect(evaluator.countBack(travel, LOOKAHEAD_DAYS, 'every').toString()).toBe(
			travel.subtract({ days: LOOKAHEAD_DAYS }).toString()
		);
		expect(evaluator.countBack(travel, LOOKAHEAD_DAYS + 1, 'every')).toBeNull();
	});
});

describe('evaluate', () => {
	it('is unknown for a booking type outside 0-2', () => {
		const evaluator = createEvaluator('America/Detroit', vectors.calendars);
		const rule = {
			startPickupTime: '05:30:00',
			endPickupTime: '18:00:00',
			calendarIds: ['MC_mon-tues-wed-thurs-fri']
		};
		const result = evaluator.evaluate(
			rule,
			{ bookingType: 7 },
			Temporal.PlainDate.from('2026-03-11'),
			Temporal.Now.instant()
		);
		expect(result).toEqual({ state: 'unknown', cutoffInstant: null, openInstant: null });
	});
});
