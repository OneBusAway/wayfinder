import { env } from '$env/dynamic/public';
import { getTodayDateForInput } from '$lib/dateTimeInput';
import { handleOBAResponse } from '$lib/obaSdk';
import { getScheduleForStop } from '$lib/server/obaScheduleForStop';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, params }) {
	// Resolve once before either upstream call, including requests crossing midnight.
	const date = url.searchParams.get('date') || getTodayDateForInput(env.PUBLIC_OBA_TIMEZONE);
	const response = await getScheduleForStop(params.stopId, date);

	return handleOBAResponse(response, 'stop-for-schedule');
}
