import { describe, test, expect } from 'vitest';
import {
	faBus,
	faCableCar,
	faFerry,
	faTrain,
	faTrainSubway
} from '@fortawesome/free-solid-svg-icons';
import {
	RouteType,
	prioritizedRouteTypeForDisplay,
	generateRouteTypeSvgForDisplay
} from '$config/routeConfig';

describe('prioritizedRouteTypeForDisplay', () => {
	test.each([
		[RouteType.FERRY, faFerry],
		[RouteType.LIGHT_RAIL, faTrainSubway],
		[RouteType.SUBWAY, faTrainSubway],
		[RouteType.RAIL, faTrain],
		[RouteType.CABLE_CAR, faCableCar],
		[RouteType.GONDOLA, faCableCar],
		[RouteType.FUNICULAR, faCableCar],
		[RouteType.BUS, faBus],
		[RouteType.UNKNOWN, faBus]
	])('route type %i maps to the Font Awesome icon', (routeType, expected) => {
		expect(prioritizedRouteTypeForDisplay(routeType)).toBe(expected);
	});

	test('falls back to faBus for unrecognized route types', () => {
		expect(prioritizedRouteTypeForDisplay(12345)).toBe(faBus);
	});
});

describe('generateRouteTypeSvgForDisplay', () => {
	test('embeds the filled Font Awesome path, centered on the origin', () => {
		const [width, height, , , pathData] = faFerry.icon;
		const svg = generateRouteTypeSvgForDisplay(RouteType.FERRY);

		expect(svg).toContain(`<path d="${pathData}" />`);
		expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
		expect(svg).toContain(`x="${-width / 32 / 2}"`);
		expect(svg).toContain(`y="${-height / 32 / 2}"`);
		// Filled glyph: color comes from the parent <g fill>, so no stroke-only override.
		expect(svg).not.toContain('fill="none"');
	});
});
