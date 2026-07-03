import { render, screen } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import RouteScheduleTable from '../RouteScheduleTable.svelte';
import { __setIsLoading } from 'svelte-i18n';

let isLoading = false;

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key, options) => {
				const translations = {
					'schedule_for_stop.hour': 'Hour',
					'schedule_for_stop.minutes': 'Minutes',
					'schedule_for_stop.no_am_schedules_available': 'No AM schedules available',
					'schedule_for_stop.no_pm_schedules_available': 'No PM schedules available',
					'schedule_for_stop.schedule_table_caption': `Departure times for ${options?.values?.route ?? ''}`
				};
				return translations[key] ?? key;
			});
			return { unsubscribe: () => {} };
		})
	},
	isLoading: {
		subscribe: vi.fn((fn) => {
			fn(isLoading);
			return { unsubscribe: () => {} };
		})
	},
	__setIsLoading: (value) => {
		isLoading = value;
	}
}));

const schedule = {
	tripHeadsign: '44 - University District',
	stopTimes: {
		8: [{ arrivalTime: '8:05AM' }, { arrivalTime: '8:25AM' }],
		15: [{ arrivalTime: '3:10PM' }]
	}
};

describe('RouteScheduleTable accessibility', () => {
	beforeEach(() => {
		isLoading = false;
	});

	test('exposes the table within a keyboard-focusable labelled region', () => {
		render(RouteScheduleTable, { props: { schedule } });

		const region = screen.getByRole('region', {
			name: 'Departure times for 44 - University District'
		});
		expect(region).toHaveAttribute('tabindex', '0');
		expect(region).toHaveAttribute('aria-labelledby', 'schedule-table-caption');
		expect(region).not.toHaveAttribute('aria-label');
		expect(region.querySelector('table')).toBeInTheDocument();
	});

	test('table has a caption providing context for the route', () => {
		const { container } = render(RouteScheduleTable, { props: { schedule } });

		const caption = container.querySelector('#schedule-table-caption');
		expect(caption).toBeInTheDocument();
		expect(caption).toHaveTextContent('Departure times for 44 - University District');
	});

	test('AM and PM section rows are header cells with rowgroup scope', () => {
		render(RouteScheduleTable, { props: { schedule } });

		const amHeader = screen.getByRole('rowheader', { name: 'AM' });
		const pmHeader = screen.getByRole('rowheader', { name: 'PM' });

		expect(amHeader.tagName).toBe('TH');
		expect(amHeader).toHaveAttribute('scope', 'rowgroup');
		expect(pmHeader.tagName).toBe('TH');
		expect(pmHeader).toHaveAttribute('scope', 'rowgroup');
	});

	test('column headers use scope="col"', () => {
		render(RouteScheduleTable, { props: { schedule } });

		const hourHeader = screen.getByRole('columnheader', { name: 'Hour' });
		const minutesHeader = screen.getByRole('columnheader', { name: 'Minutes' });

		expect(hourHeader).toHaveAttribute('scope', 'col');
		expect(minutesHeader).toHaveAttribute('scope', 'col');
	});

	test('renders empty-state messaging when a section has no times', () => {
		render(RouteScheduleTable, {
			props: { schedule: { tripHeadsign: 'Empty Route', stopTimes: {} } }
		});

		expect(screen.getByText('No AM schedules available')).toBeInTheDocument();
		expect(screen.getByText('No PM schedules available')).toBeInTheDocument();
	});
});

describe('RouteScheduleTable loading state', () => {
	beforeEach(() => {
		__setIsLoading(true);
	});

	afterEach(() => {
		__setIsLoading(false);
	});

	test('keeps a stable region name reference while i18n loads', () => {
		const { container } = render(RouteScheduleTable, { props: { schedule } });

		const region = container.querySelector('[role="region"]');
		expect(region).not.toHaveAttribute('aria-label');
		expect(region).toHaveAttribute('aria-labelledby', 'schedule-table-caption');

		const caption = container.querySelector('#schedule-table-caption');
		expect(caption).toHaveTextContent('');
	});
});

describe('RouteScheduleTable content', () => {
	beforeEach(() => {
		isLoading = false;
	});

	test('renders converted hours, minute cells, and full-time titles from schedule data', () => {
		render(RouteScheduleTable, { props: { schedule } });

		const amHourCell = screen.getByTitle('Full Time: 8:05');
		expect(amHourCell).toHaveTextContent('8');
		expect(amHourCell).toHaveTextContent('AM');

		const amMinutesCell = amHourCell.closest('tr')?.querySelector('td:last-child');
		expect(amMinutesCell).toHaveTextContent('05');
		expect(amMinutesCell).toHaveTextContent('25');

		const pmHourCell = screen.getByTitle('Full Time: 15:10');
		expect(pmHourCell).toHaveTextContent('3');
		expect(pmHourCell).toHaveTextContent('PM');

		const pmMinutesCell = pmHourCell.closest('tr')?.querySelector('td:last-child');
		expect(pmMinutesCell).toHaveTextContent('10');
	});
});
