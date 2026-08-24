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
					'schedule_for_stop.no_schedules_available':
						'No schedules available for the selected date.',
					'schedule_for_stop.schedule_table_caption': `Departure times for ${options?.values?.route ?? ''}`,
					'schedule_for_stop.short_line': 'Short line',
					'schedule_for_stop.short_line_to': `Short line to ${options?.values?.destination ?? ''}`,
					'schedule_for_stop.short_line_notice':
						'Trips marked Short line end before the route’s usual destination.'
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
		const { container } = render(RouteScheduleTable, { props: { schedule } });

		const region = screen.getByRole('region', {
			name: 'Departure times for 44 - University District'
		});
		const caption = container.querySelector('caption');
		expect(region).toHaveAttribute('tabindex', '0');
		expect(region).toHaveAttribute('aria-labelledby', caption.id);
		expect(caption.id).toMatch(/^schedule-table-caption-/);
		expect(region).not.toHaveAttribute('aria-label');
		expect(region.querySelector('table')).toBeInTheDocument();
	});

	test('table has a caption providing context for the route', () => {
		const { container } = render(RouteScheduleTable, { props: { schedule } });

		const caption = container.querySelector('caption');
		expect(caption).toBeInTheDocument();
		expect(caption).toHaveTextContent('Departure times for 44 - University District');
	});

	test('assigns a unique caption id per instance', () => {
		const { container: first } = render(RouteScheduleTable, { props: { schedule } });
		const { container: second } = render(RouteScheduleTable, {
			props: { schedule: { ...schedule, tripHeadsign: '8 - Rainier Beach' } }
		});

		const firstCaption = first.querySelector('caption');
		const secondCaption = second.querySelector('caption');
		const firstRegion = first.querySelector('[role="region"]');
		const secondRegion = second.querySelector('[role="region"]');

		expect(firstCaption.id).not.toBe(secondCaption.id);
		expect(firstRegion).toHaveAttribute('aria-labelledby', firstCaption.id);
		expect(secondRegion).toHaveAttribute('aria-labelledby', secondCaption.id);
	});

	test('uses each hour as its row header without redundant AM and PM section rows', () => {
		render(RouteScheduleTable, { props: { schedule } });

		const amHour = screen.getByRole('rowheader', { name: '8 AM' });
		const pmHour = screen.getByRole('rowheader', { name: '3 PM' });

		expect(amHour).toHaveAttribute('scope', 'row');
		expect(pmHour).toHaveAttribute('scope', 'row');
		expect(screen.queryByRole('rowheader', { name: 'AM' })).not.toBeInTheDocument();
		expect(screen.queryByRole('rowheader', { name: 'PM' })).not.toBeInTheDocument();
	});

	test('column headers use scope="col"', () => {
		render(RouteScheduleTable, { props: { schedule } });

		const hourHeader = screen.getByRole('columnheader', { name: 'Hour' });
		const minutesHeader = screen.getByRole('columnheader', { name: 'Minutes' });

		expect(hourHeader).toHaveAttribute('scope', 'col');
		expect(minutesHeader).toHaveAttribute('scope', 'col');
	});

	test('renders empty-state messaging when no times are available', () => {
		render(RouteScheduleTable, {
			props: { schedule: { tripHeadsign: 'Empty Route', stopTimes: {} } }
		});

		expect(screen.getByText('No schedules available for the selected date.')).toBeInTheDocument();
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
		const caption = container.querySelector('caption');
		expect(region).not.toHaveAttribute('aria-label');
		expect(region).toHaveAttribute('aria-labelledby', caption.id);
		expect(caption.id).toMatch(/^schedule-table-caption-/);
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

	test('removes lowercase am and pm suffixes from minute chips', () => {
		render(RouteScheduleTable, {
			props: {
				schedule: {
					tripHeadsign: 'Lowercase meridiem',
					stopTimes: {
						8: [{ arrivalTime: '8:05am' }],
						15: [{ arrivalTime: '3:10pm' }]
					}
				}
			}
		});

		expect(screen.getByTitle('Full Time: 8:05')).toHaveTextContent('8');
		expect(screen.getByTitle('Full Time: 15:10')).toHaveTextContent('3');
		expect(screen.queryByText(/05 am/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/10 pm/i)).not.toBeInTheDocument();
	});

	test('clearly identifies short-line trips with their destination', () => {
		render(RouteScheduleTable, {
			props: {
				schedule: {
					tripHeadsign: '120 - Kearny Mesa',
					stopTimes: {
						8: [
							{ arrivalTime: '8:05AM' },
							{
								arrivalTime: '8:25AM',
								isShortLine: true,
								destination: 'Fashion Valley'
							}
						]
					}
				}
			}
		});

		expect(
			screen.getByText('Trips marked Short line end before the route’s usual destination.')
		).toBeInTheDocument();
		const shortLine = screen.getByText('Short line to Fashion Valley').closest('[data-short-line]');
		expect(shortLine).toHaveTextContent('25');
		expect(shortLine).toHaveAttribute('data-short-line', 'true');
		expect(screen.queryByText('Short line to Kearny Mesa')).not.toBeInTheDocument();
	});
});
