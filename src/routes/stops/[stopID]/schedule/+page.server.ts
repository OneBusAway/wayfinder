import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { getTodayDateForInput } from '$lib/dateTimeInput';
import { getRouteSchedules } from '$lib/scheduleForStop';
import { getScheduleForStop } from '$lib/server/obaScheduleForStop';
import { getAgencyFilter, filterRoutes, filterRouteIds } from '$lib/agencyFilter';

export async function load({ params }) {
	const serviceDay = getTodayDateForInput(env.PUBLIC_OBA_TIMEZONE);
	const response = await getScheduleForStop(params.stopID, serviceDay);

	// OBA answers for a stop that doesn't exist with an empty response (or code 404).
	if (!response || response.code === 404) {
		error(404, 'Stop not found.');
	}

	if (response.code !== 200) {
		error(500, 'Unable to fetch stop-for-schedule.');
	}

	const scheduleForStop = response.data;
	const { stopId } = scheduleForStop.entry;
	const stop = scheduleForStop.references.stops.find((stop) => stop.id === stopId);

	// OBA includes the stop in the references; the page can't render without it.
	if (!stop) {
		error(500, 'Unable to fetch stop.');
	}

	const agencyFilter = getAgencyFilter();
	if (agencyFilter) {
		if (scheduleForStop.references?.routes) {
			scheduleForStop.references.routes = filterRoutes(
				scheduleForStop.references.routes,
				agencyFilter
			);
		}
		if (stop.routeIds) {
			stop.routeIds = filterRouteIds(stop.routeIds, agencyFilter);
		}
	}

	return {
		routes: scheduleForStop.references?.routes ?? [],
		schedules: getRouteSchedules(scheduleForStop, env.PUBLIC_OBA_TIMEZONE || undefined),
		serviceDay,
		stop,
		stopId
	};
}
