import { describe, it, expect } from 'vitest';
import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon.js';

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
});
