import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { env } from '$env/dynamic/public';
import { dateToServiceDay, getRouteSchedules } from '$lib/scheduleForStop';
import StopSchedulePage from '../../routes/stops/[stopID]/schedule/+page.svelte';

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_OBA_TIMEZONE: 'America/Los_Angeles' }
}));

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
			return () => {};
		})
	},
	isLoading: {
		subscribe: vi.fn((fn) => {
			fn(false);
			return () => {};
		})
	},
	locale: {
		subscribe: vi.fn((fn) => {
			fn('en');
			return () => {};
		})
	}
}));

const stop = {
	code: '75403',
	direction: 'SW',
	id: '1_75403',
	lat: 47.6105,
	lon: -122.3363,
	name: 'Pine St & 3rd Ave'
};

const route = { id: '1_100', shortName: '8' };

// Days in the month the date picker opens to, other than today (preselected)
const [otherDate, anotherDate] = [1, 2, 3]
	.filter((day) => day !== new Date().getDate())
	.map((day) => new Date(new Date().setDate(day)));

function directionSchedule(tripHeadsign) {
	return {
		scheduleStopTimes: [{ arrivalTime: 0, departureTime: 0, tripId: '1_trip' }],
		tripHeadsign
	};
}

function routeSchedule(tripHeadsign, routeId = route.id) {
	return { routeId, stopRouteDirectionSchedules: [directionSchedule(tripHeadsign)] };
}

function scheduleForStop(stopRouteSchedules, routes = [route]) {
	return {
		entry: { stopId: stop.id, stopRouteSchedules },
		references: { routes, stops: [stop] }
	};
}

function scheduleResponse(stopRouteSchedules) {
	return { json: async () => ({ data: scheduleForStop(stopRouteSchedules) }), ok: true };
}

// Renders the page with what the server load provides: today's schedules,
// already grouped, and the stop.
function renderPage(stopRouteSchedules, routes) {
	return render(StopSchedulePage, {
		props: {
			data: {
				schedules: getRouteSchedules(
					scheduleForStop(stopRouteSchedules, routes),
					env.PUBLIC_OBA_TIMEZONE
				),
				serviceDay: dateToServiceDay(new Date()),
				stop,
				stopId: stop.id
			}
		}
	});
}

async function selectDate(user, date) {
	await user.click(screen.getByRole('button', { name: 'Open date picker' }));
	await user.click(
		screen.getByRole('gridcell', {
			name: date.toLocaleDateString('default', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			})
		})
	);
}

describe('/stops/[stopID]/schedule', () => {
	let fetchMock;

	// Holds the next request open until the returned function resolves it.
	// Like fetch, rejects with an AbortError once the request's signal aborts.
	function pendingFetch() {
		let resolve;
		fetchMock.mockImplementationOnce(
			(url, { signal }) =>
				new Promise((res, reject) => {
					resolve = res;
					signal.addEventListener('abort', () =>
						reject(new DOMException('The operation was aborted.', 'AbortError'))
					);
				})
		);
		return (response) => resolve(response);
	}

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	test("shows today's schedule from the server without fetching it again", async () => {
		const { container } = renderPage([routeSchedule('Capitol Hill')]);
		await tick();

		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(stop.name);
		expect(screen.getByText('8 - Capitol Hill')).toBeInTheDocument();
		expect(screen.getByRole('textbox')).toHaveValue(
			new Date().toLocaleDateString('default', { year: 'numeric', month: 'long', day: 'numeric' })
		);
		expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test('shows the stop and a no-schedules message on a day with no service', () => {
		const { container } = renderPage([]);

		expect(screen.getByText('schedule_for_stop.no_schedules_available')).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(stop.name);
		expect(screen.getByRole('button', { name: 'favorites.add' })).toBeInTheDocument();
		expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
	});

	test('shows the no-schedules message when no route has a direction schedule', () => {
		renderPage([{ routeId: route.id, stopRouteDirectionSchedules: [] }]);

		expect(screen.getByText('schedule_for_stop.no_schedules_available')).toBeInTheDocument();
	});

	test('shows every direction schedule, even two with the same label', () => {
		const loop = routeSchedule('Downtown Loop');
		loop.stopRouteDirectionSchedules.push(directionSchedule('Downtown Loop'));

		renderPage([loop]);

		expect(screen.getAllByText('8 - Downtown Loop')).toHaveLength(2);
	});

	test('labels a route by its long name when it has no short name', () => {
		renderPage(
			[routeSchedule('Pier 62', '1_300')],
			[{ id: '1_300', longName: 'Waterfront Shuttle', shortName: '' }]
		);

		expect(screen.getByText('Waterfront Shuttle - Pier 62')).toBeInTheDocument();
	});

	test("shows times in the region's timezone, not the viewer's", async () => {
		const user = userEvent.setup();
		const capitolHill = routeSchedule('Capitol Hill');
		// 8:05am in Los Angeles is 3:05pm UTC, the test runner's timezone.
		capitolHill.stopRouteDirectionSchedules[0].scheduleStopTimes[0].arrivalTime = new Date(
			'2026-10-02T15:05:00Z'
		).getTime();

		renderPage([capitolHill]);
		await user.click(screen.getByRole('button', { name: '8 - Capitol Hill' }));

		expect(screen.getByTitle('Full Time: 8:05')).toBeInTheDocument();
	});

	test('labels a route missing from the references by its id', () => {
		renderPage([routeSchedule('Ballard', '1_200')]);

		expect(screen.getByText('200 - Ballard')).toBeInTheDocument();
	});

	test('fetches the picked calendar day', async () => {
		const user = userEvent.setup();
		fetchMock.mockResolvedValueOnce(scheduleResponse([routeSchedule('Downtown')]));

		renderPage([routeSchedule('Capitol Hill')]);
		await selectDate(user, otherDate);

		expect(fetchMock.mock.calls[0][0]).toBe(
			`/api/oba/schedule-for-stop/${stop.id}?date=${dateToServiceDay(otherDate)}`
		);
		expect(await screen.findByText('8 - Downtown')).toBeInTheDocument();
	});

	test("dims the previous date's schedules while another date loads", async () => {
		const user = userEvent.setup();
		const resolveOtherDate = pendingFetch();

		renderPage([routeSchedule('Capitol Hill')]);
		const previous = screen.getByText('8 - Capitol Hill');
		await selectDate(user, otherDate);

		// Svelte sets `inert` as a property, which jsdom doesn't reflect to an
		// attribute the way browsers do, so check the property.
		const schedulesList = screen.getByTestId('route-schedules');
		expect(schedulesList.inert).toBe(true);
		expect(schedulesList).toHaveClass('opacity-50');
		expect(schedulesList).toContainElement(previous);
		expect(previous.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');

		resolveOtherDate(scheduleResponse([routeSchedule('Downtown')]));

		const current = await screen.findByText('8 - Downtown');
		expect(schedulesList.inert).toBe(false);
		expect(schedulesList).not.toHaveClass('opacity-50');
		expect(current.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
	});

	test('shows a skeleton instead of the no-schedules message while another date loads', async () => {
		const user = userEvent.setup();
		pendingFetch();

		const { container } = renderPage([]);
		await selectDate(user, otherDate);

		expect(screen.queryByText('schedule_for_stop.no_schedules_available')).not.toBeInTheDocument();
		expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
	});

	test("replaces the previous date's schedules with an error when another date fails to load", async () => {
		const user = userEvent.setup();
		fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

		renderPage([routeSchedule('Capitol Hill')]);
		await selectDate(user, otherDate);

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'schedule_for_stop.schedules_load_failed'
		);
		expect(screen.queryByText('8 - Capitol Hill')).not.toBeInTheDocument();
		// The stop doesn't depend on the date, so the header keeps it.
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(stop.name);
	});

	test('shows a skeleton instead of the error while another date loads', async () => {
		const user = userEvent.setup();
		fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
		const resolveAnotherDate = pendingFetch();

		const { container } = renderPage([routeSchedule('Capitol Hill')]);
		await selectDate(user, otherDate);
		await screen.findByRole('alert');
		await selectDate(user, anotherDate);

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(container.querySelector('.animate-pulse')).toBeInTheDocument();

		resolveAnotherDate(scheduleResponse([routeSchedule('Downtown')]));

		expect(await screen.findByText('8 - Downtown')).toBeInTheDocument();
		expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
	});

	test('ignores a superseded request for a date that is no longer selected', async () => {
		const user = userEvent.setup();
		const resolveOtherDate = pendingFetch();
		const resolveAnotherDate = pendingFetch();

		renderPage([routeSchedule('Capitol Hill')]);
		await selectDate(user, otherDate);
		await selectDate(user, anotherDate);

		// The superseded request is aborted without ending the newer one's loading state.
		const schedulesList = screen.getByTestId('route-schedules');
		expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
		expect(schedulesList.inert).toBe(true);

		resolveAnotherDate(scheduleResponse([routeSchedule('Downtown')]));
		resolveOtherDate(scheduleResponse([routeSchedule('University District')]));

		await screen.findByText('8 - Downtown');
		expect(schedulesList.inert).toBe(false);
		expect(screen.queryByText('8 - University District')).not.toBeInTheDocument();
		expect(console.error).not.toHaveBeenCalled();
	});

	test('cancels a date still loading when the page closes', async () => {
		const user = userEvent.setup();
		pendingFetch();

		const { unmount } = renderPage([routeSchedule('Capitol Hill')]);
		await selectDate(user, otherDate);
		unmount();
		await tick();

		expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
		expect(console.error).not.toHaveBeenCalled();
	});
});
