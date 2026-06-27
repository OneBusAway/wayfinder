import { render, screen } from '@testing-library/svelte';
import { expect, test, describe, vi } from 'vitest';
import RouteScheduleTable from '../RouteScheduleTable.svelte';

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
			fn(false);
			return { unsubscribe: () => {} };
		})
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
	test('exposes the table within a keyboard-focusable labelled region', () => {
		render(RouteScheduleTable, { props: { schedule } });

		const region = screen.getByRole('region', {
			name: 'Departure times for 44 - University District'
		});
		expect(region).toHaveAttribute('tabindex', '0');
		expect(region.querySelector('table')).toBeInTheDocument();
	});

	test('table has a caption providing context for the route', () => {
		const { container } = render(RouteScheduleTable, { props: { schedule } });

		const caption = container.querySelector('caption');
		expect(caption).toBeInTheDocument();
		expect(caption).toHaveTextContent('Departure times for 44 - University District');
	});

	test('AM and PM section rows are header cells with colgroup scope', () => {
		render(RouteScheduleTable, { props: { schedule } });

		const amHeader = screen.getByRole('columnheader', { name: 'AM' });
		const pmHeader = screen.getByRole('columnheader', { name: 'PM' });

		expect(amHeader.tagName).toBe('TH');
		expect(amHeader).toHaveAttribute('scope', 'colgroup');
		expect(pmHeader.tagName).toBe('TH');
		expect(pmHeader).toHaveAttribute('scope', 'colgroup');
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
