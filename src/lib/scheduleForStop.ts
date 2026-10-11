import type { ScheduleForStopRetrieveResponse } from 'onebusaway-sdk/resources/schedule-for-stop';
import { error } from '@sveltejs/kit';
import { msToPlainTime } from '$lib/dateTimeFormat.js';
import { removeAgencyPrefix } from '$lib/utils';

export type ScheduleStopTime =
	ScheduleForStopRetrieveResponse.Data.Entry.StopRouteSchedule.StopRouteDirectionSchedule.ScheduleStopTime & {
		/**
		 * The trip's own headsign, added by `getScheduleForStop`
		 */
		tripHeadsign?: string;
	};

interface ScheduleTableStopTime {
	/**
	 * Minute of the arrival within its hour group.
	 */
	arrivalMinute: number;
	destination: string;
	isShortLine: boolean;
}

export interface RouteSchedule {
	stopTimes: Record<number, ScheduleTableStopTime[]>;
	/**
	 * The table's label: route name and the direction's headsign
	 */
	tripHeadsign: string;
}

/**
 * Fetches a stop's schedule for one service day through the app's API route,
 * which the schedule page uses in the browser for dates other than today. The
 * route and the page's server load share `$lib/server/obaScheduleForStop`, so both
 * get the same agency filtering and trip headsigns.
 *
 * @param fetch
 * @param stopId Full agency-prefixed OBA id
 * @param serviceDay YYYY-MM-DD
 * @param [options]
 */
export async function fetchScheduleForStop(
	fetch: typeof globalThis.fetch,
	stopId: string,
	serviceDay: string,
	{ signal }: { signal?: AbortSignal } = {}
): Promise<ScheduleForStopRetrieveResponse.Data> {
	const response = await fetch(
		`/api/oba/schedule-for-stop/${encodeURIComponent(stopId)}?date=${serviceDay}`,
		{ signal }
	);
	if (!response.ok) {
		error(response.status, 'Unable to fetch schedule for stop.');
	}
	const { data }: ScheduleForStopRetrieveResponse = await response.json();
	return data;
}

/**
 * The date picker works in local midnight `Date`s; the API takes YYYY-MM-DD.
 * Converting through local date parts (not `toISOString()`, which is UTC)
 * keeps the calendar day the user picked.
 *
 * @param serviceDay YYYY-MM-DD
 */
export function serviceDayToDate(serviceDay: string): Date {
	const { day, month, year } = Temporal.PlainDate.from(serviceDay);
	return new Date(year, month - 1, day);
}

/**
 * @param date
 * @returns YYYY-MM-DD
 */
export function dateToServiceDay(date: Date): string {
	return new Temporal.PlainDate(date.getFullYear(), date.getMonth() + 1, date.getDate()).toString();
}

/**
 * One schedule table per route direction at the stop. The schedule page's
 * server load groups today's this way, so the page arrives ready to render and
 * the browser doesn't group it again; the page groups other dates as they load.
 */
export function getRouteSchedules(
	scheduleForStop: ScheduleForStopRetrieveResponse.Data,
	timeZone?: string
): RouteSchedule[] {
	const routeReference = new Map(
		scheduleForStop.references.routes.map((route) => [route.id, route])
	);

	return scheduleForStop.entry.stopRouteSchedules.flatMap((routeSchedule) => {
		// `getScheduleForStop` passes malformed entries through (see
		// `addTripHeadsigns`); skip them here too rather than failing the whole page.
		const directions = routeSchedule?.stopRouteDirectionSchedules;
		if (!routeSchedule?.routeId || !Array.isArray(directions)) return [];

		const route = routeReference.get(routeSchedule.routeId);

		// A route missing from the references (or without a name) is labeled by
		// its id rather than having its times dropped.
		const routeName =
			route?.shortName || route?.longName || removeAgencyPrefix(routeSchedule.routeId);

		return directions.flatMap((directionSchedule) =>
			Array.isArray(directionSchedule?.scheduleStopTimes)
				? [
						{
							stopTimes: groupStopTimesByHour(
								directionSchedule.scheduleStopTimes,
								directionSchedule.tripHeadsign,
								timeZone
							),
							tripHeadsign: `${routeName} - ${directionSchedule.tripHeadsign}`
						}
					]
				: []
		);
	});
}

/**
 * Arrange a direction's stop times for the schedule table and flag trips that
 * end before the direction's normal destination.
 *
 * Pass the region's timezone so times are grouped and shown as the agency
 * schedules them, not shifted to the viewer's (or the server's) timezone.
 *
 * `stopHeadsign` is not populated by OBA's schedule-for-stop endpoint.
 * `getScheduleForStop` adds the per-trip `tripHeadsign` from schedule-for-route.
 */
export function groupStopTimesByHour(
	stopTimes: ScheduleStopTime[],
	directionHeadsign: string,
	timeZone?: string
): Record<number, ScheduleTableStopTime[]> {
	const grouped: Record<number, ScheduleTableStopTime[]> = {};
	for (const stopTime of stopTimes) {
		// A time without a valid arrival can't be placed in an hour; skip it so it
		// doesn't take down the rest of the schedule.
		if (!Number.isFinite(stopTime?.arrivalTime)) continue;

		const time = msToPlainTime(stopTime.arrivalTime, timeZone);
		if (!grouped[time.hour]) grouped[time.hour] = [];

		const destination = stopTime.tripHeadsign?.trim() || directionHeadsign;
		grouped[time.hour].push({
			arrivalMinute: time.minute,
			destination,
			isShortLine: destination !== directionHeadsign
		});
	}

	return grouped;
}
