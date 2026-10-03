import { describe, it, expect } from 'vitest';
import { hoursRows, formatDayRanges } from '$lib/onDemand/hours.js';
import { parsedService, ruleJson } from '../../fixtures/onDemand.js';

const today = Temporal.PlainDate.from('2026-03-11');
// ICU may put a narrow no-break space before AM/PM; compare with plain spaces.
const rowsOf = (service) =>
	JSON.parse(
		JSON.stringify(hoursRows(service, { locale: 'en-US', today })).replace(
			// eslint-disable-next-line no-irregular-whitespace
			/ /g,
			' '
		)
	);
const cal = (id, days, endDate = '2026-12-31') => ({
	id,
	days,
	startDate: '2026-01-01',
	endDate,
	exceptedDates: []
});

describe('formatDayRanges', () => {
	it('collapses consecutive days into ranges', () => {
		expect(formatDayRanges(['mon', 'tue', 'wed', 'thu', 'fri'], 'en-US')).toBe('Mon–Fri');
		expect(formatDayRanges(['mon', 'wed'], 'en-US')).toBe('Mon, Wed');
		expect(formatDayRanges(['sat', 'sun'], 'en-US')).toBe('Sat–Sun');
	});
});

describe('hoursRows', () => {
	it('merges weekday and Saturday rules with equal hours and marks Sunday as no service', () => {
		const service = parsedService(
			{
				rules: [
					ruleJson({ startPickupTime: '07:00:00', endPickupTime: '18:00:00', calendarIds: ['wk'] }),
					ruleJson({ startPickupTime: '07:00:00', endPickupTime: '18:00:00', calendarIds: ['sat'] })
				]
			},
			{ calendars: [cal('wk', ['mon', 'tue', 'wed', 'thu', 'fri']), cal('sat', ['sat'])] }
		);
		expect(rowsOf(service)).toEqual([
			{
				kind: 'hours',
				days: 'Mon–Sat',
				start: '7:00 AM',
				end: '6:00 PM',
				startNextDay: false,
				endNextDay: false
			},
			{ kind: 'noService', days: 'Sun' }
		]);
	});

	it('marks a window past midnight as next day', () => {
		const service = parsedService(
			{},
			{ calendars: [cal('cal_mon_sat', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])] }
		);
		const [row] = rowsOf(service);
		expect(row).toMatchObject({ start: '5:00 AM', end: '12:50 AM', endNextDay: true });
	});

	it('reads all service hours for a rule without times, and lists Sat–Sun for a weekday calendar', () => {
		const service = parsedService(
			{ rules: [ruleJson({ startPickupTime: null, endPickupTime: null, calendarIds: ['wk'] })] },
			{ calendars: [cal('wk', ['mon', 'tue', 'wed', 'thu', 'fri'])] }
		);
		expect(rowsOf(service)).toEqual([
			{ kind: 'allHours', days: 'Mon–Fri' },
			{ kind: 'noService', days: 'Sat–Sun' }
		]);
	});

	it('ignores calendars that ended before today when finding no-service days', () => {
		const service = parsedService(
			{
				rules: [
					ruleJson({ startPickupTime: '07:00:00', endPickupTime: '18:00:00', calendarIds: ['wk'] }),
					ruleJson({
						startPickupTime: '09:00:00',
						endPickupTime: '12:00:00',
						calendarIds: ['oldsun']
					})
				]
			},
			{
				calendars: [
					cal('wk', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']),
					cal('oldsun', ['sun'], '2025-12-31')
				]
			}
		);
		expect(rowsOf(service).at(-1)).toEqual({ kind: 'noService', days: 'Sun' });
	});
});
