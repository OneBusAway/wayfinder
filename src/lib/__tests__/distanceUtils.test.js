import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	detectDistanceUnit,
	resolveDistanceUnit,
	formatDistance,
	getWalkDistanceOptions,
	snapToClosestOption,
	formatWalkDistanceLabel,
	UNIT_METRIC,
	UNIT_IMPERIAL
} from '../distanceUtils';

// Mock environment variable
vi.mock('$env/static/public', () => ({
	PUBLIC_DISTANCE_UNIT: ''
}));

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('distanceUtils', () => {
	const originalNavigator = global.navigator;

	afterEach(() => {
		// Restore original navigator after each test
		global.navigator = originalNavigator;
	});

	describe('detectDistanceUnit', () => {
		it('returns imperial for en-US locale', () => {
			global.navigator = { language: 'en-US' };
			expect(detectDistanceUnit()).toBe(UNIT_IMPERIAL);
		});

		it('returns imperial for en-US variant locale', () => {
			global.navigator = { language: 'en-US-x-custom' };
			expect(detectDistanceUnit()).toBe(UNIT_IMPERIAL);
		});

		it('returns metric for en-GB locale', () => {
			global.navigator = { language: 'en-GB' };
			expect(detectDistanceUnit()).toBe(UNIT_METRIC);
		});

		it('returns metric for German locale', () => {
			global.navigator = { language: 'de-DE' };
			expect(detectDistanceUnit()).toBe(UNIT_METRIC);
		});

		it('returns metric for French locale', () => {
			global.navigator = { language: 'fr-FR' };
			expect(detectDistanceUnit()).toBe(UNIT_METRIC);
		});

		it('returns metric for Japanese locale', () => {
			global.navigator = { language: 'ja-JP' };
			expect(detectDistanceUnit()).toBe(UNIT_METRIC);
		});

		it('returns metric when navigator.language is empty', () => {
			global.navigator = { language: '' };
			expect(detectDistanceUnit()).toBe(UNIT_METRIC);
		});

		it('returns metric when navigator.language is undefined', () => {
			global.navigator = { language: undefined };
			expect(detectDistanceUnit()).toBe(UNIT_METRIC);
		});
	});

	describe('resolveDistanceUnit', () => {
		beforeEach(() => {
			global.navigator = { language: 'en-US' };
		});

		it('returns user preference when explicitly set to metric', () => {
			expect(resolveDistanceUnit(UNIT_METRIC)).toBe(UNIT_METRIC);
		});

		it('returns user preference when explicitly set to imperial', () => {
			expect(resolveDistanceUnit(UNIT_IMPERIAL)).toBe(UNIT_IMPERIAL);
		});

		it('falls back to browser detection when user preference is null', () => {
			// navigator.language is 'en-US', so should return imperial
			expect(resolveDistanceUnit(null)).toBe(UNIT_IMPERIAL);
		});

		it('falls back to browser detection when user preference is undefined', () => {
			expect(resolveDistanceUnit(undefined)).toBe(UNIT_IMPERIAL);
		});

		it('falls back to browser detection for other locales', () => {
			global.navigator = { language: 'de-DE' };
			expect(resolveDistanceUnit(null)).toBe(UNIT_METRIC);
		});
	});

	describe('formatDistance', () => {
		// Mock translator function
		const mockTranslator = (key) => {
			const translations = {
				'units.meters': 'm',
				'units.kilometers': 'km',
				'units.feet': 'ft',
				'units.mile': 'mile',
				'units.miles': 'miles'
			};
			return translations[key] || key;
		};

		describe('metric formatting', () => {
			it('formats small distances in meters', () => {
				expect(formatDistance(50, UNIT_METRIC, mockTranslator)).toBe('50 m');
				expect(formatDistance(467, UNIT_METRIC, mockTranslator)).toBe('467 m');
				expect(formatDistance(999, UNIT_METRIC, mockTranslator)).toBe('999 m');
			});

			it('rounds meters to nearest integer', () => {
				expect(formatDistance(467.6, UNIT_METRIC, mockTranslator)).toBe('468 m');
				expect(formatDistance(467.4, UNIT_METRIC, mockTranslator)).toBe('467 m');
			});

			it('formats distances 1000m+ in kilometers', () => {
				expect(formatDistance(1000, UNIT_METRIC, mockTranslator)).toBe('1 km');
				expect(formatDistance(1500, UNIT_METRIC, mockTranslator)).toBe('1.5 km');
				expect(formatDistance(2340, UNIT_METRIC, mockTranslator)).toBe('2.3 km');
				expect(formatDistance(5000, UNIT_METRIC, mockTranslator)).toBe('5 km');
			});

			it('rounds kilometers to 1 decimal place', () => {
				expect(formatDistance(1234, UNIT_METRIC, mockTranslator)).toBe('1.2 km');
				expect(formatDistance(1567, UNIT_METRIC, mockTranslator)).toBe('1.6 km');
			});
		});

		describe('imperial formatting', () => {
			it('formats very short distances in feet', () => {
				// Under 0.1 miles (161m) should show feet
				expect(formatDistance(30, UNIT_IMPERIAL, mockTranslator)).toBe('100 ft');
				expect(formatDistance(100, UNIT_IMPERIAL, mockTranslator)).toBe('330 ft');
				expect(formatDistance(150, UNIT_IMPERIAL, mockTranslator)).toBe('490 ft');
			});

			it('rounds feet to nearest 10', () => {
				// 30m = ~98.4ft, rounds to 100
				expect(formatDistance(30, UNIT_IMPERIAL, mockTranslator)).toBe('100 ft');
				// 45m = ~147.6ft, rounds to 150
				expect(formatDistance(45, UNIT_IMPERIAL, mockTranslator)).toBe('150 ft');
			});

			it('formats distances 0.1+ miles in miles', () => {
				expect(formatDistance(200, UNIT_IMPERIAL, mockTranslator)).toBe('0.1 miles');
				expect(formatDistance(1609, UNIT_IMPERIAL, mockTranslator)).toBe('1 mile');
				expect(formatDistance(2414, UNIT_IMPERIAL, mockTranslator)).toBe('1.5 miles');
				expect(formatDistance(3219, UNIT_IMPERIAL, mockTranslator)).toBe('2 miles');
			});

			it('uses singular "mile" for exactly 1 mile', () => {
				expect(formatDistance(1609, UNIT_IMPERIAL, mockTranslator)).toBe('1 mile');
			});

			it('uses plural "miles" for other values', () => {
				expect(formatDistance(805, UNIT_IMPERIAL, mockTranslator)).toBe('0.5 miles');
				expect(formatDistance(3219, UNIT_IMPERIAL, mockTranslator)).toBe('2 miles');
			});

			it('rounds miles to 1 decimal place', () => {
				expect(formatDistance(1850, UNIT_IMPERIAL, mockTranslator)).toBe('1.1 miles');
				expect(formatDistance(2000, UNIT_IMPERIAL, mockTranslator)).toBe('1.2 miles');
			});
		});
	});

	describe('getWalkDistanceOptions', () => {
		it('returns imperial options', () => {
			const options = getWalkDistanceOptions(UNIT_IMPERIAL);
			expect(options).toHaveLength(5);
			expect(options[0]).toEqual({ label: '¼ mile', value: 402 });
			expect(options[1]).toEqual({ label: '½ mile', value: 805 });
			expect(options[2]).toEqual({ label: '1 mile', value: 1609 });
			expect(options[3]).toEqual({ label: '2 miles', value: 3219 });
			expect(options[4]).toEqual({ label: '3 miles', value: 4828 });
		});

		it('returns metric options', () => {
			const options = getWalkDistanceOptions(UNIT_METRIC);
			expect(options).toHaveLength(5);
			expect(options[0]).toEqual({ label: '400 m', value: 400 });
			expect(options[1]).toEqual({ label: '800 m', value: 800 });
			expect(options[2]).toEqual({ label: '1.5 km', value: 1500 });
			expect(options[3]).toEqual({ label: '3 km', value: 3000 });
			expect(options[4]).toEqual({ label: '5 km', value: 5000 });
		});
	});

	describe('snapToClosestOption', () => {
		it('snaps to closest imperial option', () => {
			// Exact match
			expect(snapToClosestOption(1609, UNIT_IMPERIAL)).toBe(1609);

			// Close to ¼ mile (402m)
			expect(snapToClosestOption(400, UNIT_IMPERIAL)).toBe(402);
			expect(snapToClosestOption(500, UNIT_IMPERIAL)).toBe(402);

			// Closer to ½ mile (805m)
			expect(snapToClosestOption(700, UNIT_IMPERIAL)).toBe(805);
			expect(snapToClosestOption(800, UNIT_IMPERIAL)).toBe(805);

			// Closer to 1 mile (1609m)
			expect(snapToClosestOption(1500, UNIT_IMPERIAL)).toBe(1609);
			expect(snapToClosestOption(1400, UNIT_IMPERIAL)).toBe(1609);

			// Closer to 2 miles (3219m)
			expect(snapToClosestOption(3000, UNIT_IMPERIAL)).toBe(3219);

			// Large value snaps to 3 miles (4828m)
			expect(snapToClosestOption(5000, UNIT_IMPERIAL)).toBe(4828);
		});

		it('snaps to closest metric option', () => {
			// Exact match
			expect(snapToClosestOption(1500, UNIT_METRIC)).toBe(1500);

			// Close to 400m
			expect(snapToClosestOption(402, UNIT_METRIC)).toBe(400);
			expect(snapToClosestOption(500, UNIT_METRIC)).toBe(400);

			// Close to 800m
			expect(snapToClosestOption(700, UNIT_METRIC)).toBe(800);
			expect(snapToClosestOption(805, UNIT_METRIC)).toBe(800);

			// Close to 1.5km (1500m)
			expect(snapToClosestOption(1609, UNIT_METRIC)).toBe(1500);

			// Close to 3km (3000m)
			expect(snapToClosestOption(3219, UNIT_METRIC)).toBe(3000);

			// Close to 5km (5000m)
			expect(snapToClosestOption(4828, UNIT_METRIC)).toBe(5000);
		});

		it('handles unit switching scenarios', () => {
			// Imperial 1 mile (1609m) -> Metric closest is 1.5km (1500m)
			expect(snapToClosestOption(1609, UNIT_METRIC)).toBe(1500);

			// Metric 1.5km (1500m) -> Imperial closest is 1 mile (1609m)
			expect(snapToClosestOption(1500, UNIT_IMPERIAL)).toBe(1609);

			// Imperial 2 miles (3219m) -> Metric closest is 3km (3000m)
			expect(snapToClosestOption(3219, UNIT_METRIC)).toBe(3000);

			// Metric 3km (3000m) -> Imperial closest is 2 miles (3219m)
			expect(snapToClosestOption(3000, UNIT_IMPERIAL)).toBe(3219);
		});
	});

	describe('formatWalkDistanceLabel', () => {
		it('returns label for known imperial options', () => {
			expect(formatWalkDistanceLabel(402, UNIT_IMPERIAL)).toBe('¼ mile');
			expect(formatWalkDistanceLabel(805, UNIT_IMPERIAL)).toBe('½ mile');
			expect(formatWalkDistanceLabel(1609, UNIT_IMPERIAL)).toBe('1 mile');
			expect(formatWalkDistanceLabel(3219, UNIT_IMPERIAL)).toBe('2 miles');
			expect(formatWalkDistanceLabel(4828, UNIT_IMPERIAL)).toBe('3 miles');
		});

		it('returns label for known metric options', () => {
			expect(formatWalkDistanceLabel(400, UNIT_METRIC)).toBe('400 m');
			expect(formatWalkDistanceLabel(800, UNIT_METRIC)).toBe('800 m');
			expect(formatWalkDistanceLabel(1500, UNIT_METRIC)).toBe('1.5 km');
			expect(formatWalkDistanceLabel(3000, UNIT_METRIC)).toBe('3 km');
			expect(formatWalkDistanceLabel(5000, UNIT_METRIC)).toBe('5 km');
		});

		it('falls back to formatted value for unknown values', () => {
			// Unknown imperial value
			expect(formatWalkDistanceLabel(2000, UNIT_IMPERIAL)).toBe('1.2 miles');
			expect(formatWalkDistanceLabel(1609, UNIT_IMPERIAL)).toBe('1 mile'); // Exact match

			// Unknown metric value
			expect(formatWalkDistanceLabel(1609, UNIT_METRIC)).toBe('1.6 km');
			expect(formatWalkDistanceLabel(750, UNIT_METRIC)).toBe('750 m');
		});
	});
});
