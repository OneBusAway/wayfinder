import { describe, it, expect, vi } from 'vitest';
import { createVehicleIconSvg } from '../generateVehicleIcon';
import { RouteType } from '$config/routeConfig';

vi.mock('$lib/mathUtils', () => ({
	toDirection: vi.fn((val) => {
		if (val === null || val === undefined || Number.isNaN(val) || !Number.isFinite(val)) {
			return null;
		}
		return val;
	})
}));

vi.mock('$config/routeConfig', () => ({
	generateRouteTypeSvgForDisplay: vi.fn(() => '<path d="M0,0 L10,10"/>'),
	RouteType: {
		BUS: 'bus',
		LIGHT_RAIL: 'light-rail'
	}
}));

describe('createVehicleIconSvg', () => {
	it('should not include arrow when orientation is null', () => {
		const svg = createVehicleIconSvg(null);
		expect(svg).not.toContain('<line');
		expect(svg).not.toContain('<polygon');
		expect(svg).toContain('<!-- Circle background (no directional arrow) -->');
	});

	it('should not include arrow when orientation is NaN', () => {
		const svg = createVehicleIconSvg(Number.NaN);
		expect(svg).not.toContain('<line');
		expect(svg).not.toContain('<polygon');
	});

	it('should not include arrow when orientation is undefined', () => {
		const svg = createVehicleIconSvg(undefined);
		expect(svg).not.toContain('<line');
		expect(svg).not.toContain('<polygon');
	});

	it('should not include arrow when orientation is Infinity', () => {
		const svg = createVehicleIconSvg(Infinity);
		expect(svg).not.toContain('<line');
		expect(svg).not.toContain('<polygon');
	});

	it('should include arrow when orientation is valid number (90 degrees)', () => {
		const svg = createVehicleIconSvg(90);
		expect(svg).toContain('<line');
		expect(svg).toContain('<polygon');
		expect(svg).toContain('rotate(90)');
	});

	it('should include arrow pointing north when orientation is 0', () => {
		const svg = createVehicleIconSvg(0);
		expect(svg).toContain('<line');
		expect(svg).toContain('<polygon');
		expect(svg).toContain('rotate(0)');
	});

	it('should include arrow pointing south when orientation is 180', () => {
		const svg = createVehicleIconSvg(180);
		expect(svg).toContain('<line');
		expect(svg).toContain('<polygon');
		expect(svg).toContain('rotate(180)');
	});

	it('should use custom color when provided', () => {
		const customColor = '#FF0000';
		const svg = createVehicleIconSvg(90, customColor);
		expect(svg).toContain(`stroke="${customColor}"`);
		expect(svg).toContain(`fill="${customColor}"`);
	});

	it('should use custom route type when provided', () => {
		const svg = createVehicleIconSvg(45, '#007BFF', RouteType.LIGHT_RAIL);
		expect(svg).toContain('viewBox="-28 -28 56 56"');
	});

	it('should always include circle background', () => {
		const svgWithDirection = createVehicleIconSvg(90);
		const svgWithoutDirection = createVehicleIconSvg(null);
		expect(svgWithDirection).toContain('<circle');
		expect(svgWithoutDirection).toContain('<circle');
	});
});
