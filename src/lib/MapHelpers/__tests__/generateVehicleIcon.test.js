import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({
	env: {}
}));

import {
	createVehicleIconSvg,
	getVehicleMarkerContrastColor
} from '$lib/MapHelpers/generateVehicleIcon.js';
import { contrastRatio, mapContrastColor, rgbToHex } from '$lib/colorUtils.js';

describe('getVehicleMarkerContrastColor', () => {
	it.each(['#003366', '#4B0082', '#800000', '#2E2E2E'])(
		'keeps dark route %s readable in light mode',
		(color) => {
			const routeColor = mapContrastColor(color);
			expect(routeColor.toLowerCase()).toBe(color.toLowerCase());
			expect(getVehicleMarkerContrastColor(routeColor)).toBe('#ffffff');
		}
	);

	it('maintains at least 4.5:1 glyph contrast across the colour gamut', () => {
		for (let r = 0; r <= 255; r += 17) {
			for (let g = 0; g <= 255; g += 17) {
				for (let b = 0; b <= 255; b += 17) {
					const color = rgbToHex(r, g, b);
					const backing = getVehicleMarkerContrastColor(color);
					expect(contrastRatio(color, backing), color).toBeGreaterThanOrEqual(4.5);
				}
			}
		}
	});
});

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

	it.each([false, true])('keeps glyphs readable and a visible silhouette (dark=%s)', (dark) => {
		for (const raw of [
			'#000000',
			'#003366',
			'#007BFF',
			'#808080',
			'#aaaaaa',
			'#cccccc',
			'#dddddd',
			'#eeeeee',
			'#ffffff',
			'#ffff00'
		]) {
			const color = mapContrastColor(raw, { dark });
			const svg = new DOMParser().parseFromString(
				createVehicleIconSvg(90, color, undefined, false, dark),
				'image/svg+xml'
			);
			const body = svg.querySelector('circle[r="13"]').getAttribute('fill');
			const halo = svg.querySelector('circle[r="16"]').getAttribute('fill');
			const arrows = [...svg.querySelectorAll('polygon')];
			expect(contrastRatio(color, body), raw).toBeGreaterThanOrEqual(4.5);
			expect(arrows.at(-1).getAttribute('fill')).toBe(color);
			expect(
				contrastRatio(color, arrows.at(-2).getAttribute('stroke')),
				raw
			).toBeGreaterThanOrEqual(4.5);
			if (dark) {
				expect(halo).toBe('#ffffff');
				expect(arrows[0].getAttribute('stroke')).toBe('#ffffff');
			}
		}
	});

	it('adds a contrasting backing and arrow outline for a same-colour route', () => {
		const svg = createVehicleIconSvg(0, '#000000');

		expect(svg).toContain('<circle cx="0" cy="0" r="16" fill="#ffffff"/>');
		expect(svg).toContain('stroke="#ffffff" stroke-width="6"');
		expect(svg).toContain('stroke="#000000" stroke-width="2"');
	});

	it.each(['#003366', '#4B0082', '#800000', '#2E2E2E'])(
		'renders a white backing and arrow outline for dark route %s in light mode',
		(color) => {
			const svg = new DOMParser().parseFromString(createVehicleIconSvg(90, color), 'image/svg+xml');
			const backing = svg.querySelector('circle[r="16"]');
			const ring = svg.querySelector('circle[r="13"]');
			const arrows = svg.querySelectorAll('polygon');

			expect(backing.getAttribute('fill')).toBe('#ffffff');
			expect(ring.getAttribute('fill')).toBe('#ffffff');
			expect(ring.parentElement.getAttribute('stroke')).toBe(color);
			expect(arrows[0].getAttribute('stroke')).toBe('#ffffff');
			expect(arrows[1].getAttribute('fill')).toBe(color);
			expect(svg.querySelector('path').closest('g').getAttribute('fill')).toBe(color);
			// The filled ring masks the arrow shaft before the glyph is painted.
			expect(ring.previousElementSibling).toBe(arrows[1]);
			expect(ring.nextElementSibling.tagName).toBe('svg');
		}
	);
});
