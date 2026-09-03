import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

import {
	createVehicleIconSvg,
	getVehicleMarkerContrastColor
} from '$lib/MapHelpers/generateVehicleIcon.js';

describe('createVehicleIconSvg', () => {
	it('renders no highlight glow by default', () => {
		const svg = createVehicleIconSvg(0);
		expect(svg).not.toContain('vehicle-highlight-blur');
		expect(svg).not.toContain('#FACC15');
	});

	it('renders no highlight glow when highlighted is false', () => {
		const svg = createVehicleIconSvg(0, '#007BFF', undefined, false);
		expect(svg).not.toContain('vehicle-highlight-blur');
	});

	it('renders the highlight glow and blur filter when highlighted', () => {
		const svg = createVehicleIconSvg(0, '#007BFF', undefined, true);
		expect(svg).toContain('#FACC15');
		expect(svg).toContain('feGaussianBlur');
		expect(svg).toContain('filter="url(#vehicle-highlight-blur)"');
	});

	it('always produces a valid <svg> element', () => {
		expect(createVehicleIconSvg(90, '#007BFF', undefined, true)).toContain('<svg');
		expect(createVehicleIconSvg(90)).toContain('<svg');
	});

	it('uses the most contrasting neutral backing for the route colour', () => {
		expect(getVehicleMarkerContrastColor('#000000')).toBe('#ffffff');
		expect(getVehicleMarkerContrastColor('#ffffff')).toBe('#000000');
		expect(getVehicleMarkerContrastColor('#007BFF')).toBe('#000000');
	});

	it('keeps a light backing for lightened route colours on a dark basemap', () => {
		expect(getVehicleMarkerContrastColor('#808080', true)).toBe('#ffffff');
		expect(getVehicleMarkerContrastColor('#59A9FF', true)).toBe('#ffffff');

		const svg = createVehicleIconSvg(0, '#59A9FF', undefined, false, true);
		expect(svg).toContain('<circle cx="0" cy="0" r="16" fill="#ffffff"/>');
		expect(svg).toContain('stroke="#ffffff" stroke-width="6"');
	});

	it('adds a contrasting backing and arrow outline for a same-colour route', () => {
		const svg = createVehicleIconSvg(0, '#000000');

		expect(svg).toContain('<circle cx="0" cy="0" r="16" fill="#ffffff"/>');
		expect(svg).toContain('stroke="#ffffff" stroke-width="6"');
		expect(svg).toContain('stroke="#000000" stroke-width="2"');
	});
});
