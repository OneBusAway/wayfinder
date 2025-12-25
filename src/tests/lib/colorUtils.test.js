import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { hexToRgb, rgbToHex, mixColors, generatePalette } from '$lib/colorUtils.js';

describe('colorUtils', () => {
	describe('hexToRgb', () => {
		test('converts 6-digit hex with hash', () => {
			expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
			expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
			expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
			expect(hexToRgb('#486621')).toEqual({ r: 72, g: 102, b: 33 });
		});

		test('converts 6-digit hex without hash', () => {
			expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
			expect(hexToRgb('486621')).toEqual({ r: 72, g: 102, b: 33 });
		});

		test('converts 3-digit hex with hash (shorthand)', () => {
			expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
			expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
			expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
			expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
		});

		test('converts 3-digit hex without hash (shorthand)', () => {
			expect(hexToRgb('fff')).toEqual({ r: 255, g: 255, b: 255 });
			expect(hexToRgb('f00')).toEqual({ r: 255, g: 0, b: 0 });
		});

		test('handles case insensitivity', () => {
			expect(hexToRgb('#AABBCC')).toEqual({ r: 170, g: 187, b: 204 });
			expect(hexToRgb('#aAbBcC')).toEqual({ r: 170, g: 187, b: 204 });
			expect(hexToRgb('#ABC')).toEqual({ r: 170, g: 187, b: 204 });
		});

		test('returns null for invalid input', () => {
			expect(hexToRgb('')).toBeNull();
			expect(hexToRgb('invalid')).toBeNull();
			expect(hexToRgb('#gg0000')).toBeNull();
			expect(hexToRgb('#ff00')).toBeNull(); // 4 digits
			expect(hexToRgb('#ff00000')).toBeNull(); // 7 digits
		});
	});

	describe('rgbToHex', () => {
		test('converts RGB values to hex', () => {
			expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
			expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
			expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
			expect(rgbToHex(72, 102, 33)).toBe('#486621');
		});

		test('handles edge cases (0 and 255)', () => {
			expect(rgbToHex(0, 0, 0)).toBe('#000000');
			expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
		});

		test('clamps values below 0', () => {
			expect(rgbToHex(-10, 0, 0)).toBe('#000000');
			expect(rgbToHex(0, -50, 0)).toBe('#000000');
		});

		test('clamps values above 255', () => {
			expect(rgbToHex(300, 255, 255)).toBe('#ffffff');
			expect(rgbToHex(255, 280, 255)).toBe('#ffffff');
		});

		test('rounds floating point values', () => {
			expect(rgbToHex(127.4, 127.6, 128.5)).toBe('#7f8081');
		});

		test('pads single digit hex values', () => {
			expect(rgbToHex(0, 15, 1)).toBe('#000f01');
		});
	});

	describe('mixColors', () => {
		const white = { r: 255, g: 255, b: 255 };
		const black = { r: 0, g: 0, b: 0 };
		const red = { r: 255, g: 0, b: 0 };

		test('weight 0 returns color1', () => {
			expect(mixColors(red, black, 0)).toEqual(red);
		});

		test('weight 1 returns color2', () => {
			expect(mixColors(red, black, 1)).toEqual(black);
		});

		test('weight 0.5 returns midpoint', () => {
			const result = mixColors(white, black, 0.5);
			expect(result.r).toBe(127.5);
			expect(result.g).toBe(127.5);
			expect(result.b).toBe(127.5);
		});

		test('mixing with white lightens color', () => {
			const base = { r: 72, g: 102, b: 33 };
			const result = mixColors(base, white, 0.5);
			expect(result.r).toBeGreaterThan(base.r);
			expect(result.g).toBeGreaterThan(base.g);
			expect(result.b).toBeGreaterThan(base.b);
		});

		test('mixing with black darkens color', () => {
			const base = { r: 72, g: 102, b: 33 };
			const result = mixColors(base, black, 0.5);
			expect(result.r).toBeLessThan(base.r);
			expect(result.g).toBeLessThan(base.g);
			expect(result.b).toBeLessThan(base.b);
		});
	});

	describe('generatePalette', () => {
		let consoleWarnSpy;
		let consoleErrorSpy;

		beforeEach(() => {
			consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		});

		afterEach(() => {
			consoleWarnSpy.mockRestore();
			consoleErrorSpy.mockRestore();
		});

		test('generates all 10 shades', () => {
			const palette = generatePalette('#486621');
			const shades = Object.keys(palette);

			expect(shades).toContain('50');
			expect(shades).toContain('100');
			expect(shades).toContain('200');
			expect(shades).toContain('300');
			expect(shades).toContain('400');
			expect(shades).toContain('500');
			expect(shades).toContain('600');
			expect(shades).toContain('700');
			expect(shades).toContain('800');
			expect(shades).toContain('900');
			expect(shades.length).toBe(10);
		});

		test('shade 500 equals the input color', () => {
			const palette = generatePalette('#486621');
			expect(palette['500']).toBe('#486621');

			const palette2 = generatePalette('#ff0000');
			expect(palette2['500']).toBe('#ff0000');
		});

		test('lighter shades are progressively lighter', () => {
			const palette = generatePalette('#486621');

			// Convert hex shades to brightness for comparison
			const getBrightness = (hex) => {
				const rgb = hexToRgb(hex);
				return (rgb.r + rgb.g + rgb.b) / 3;
			};

			const b50 = getBrightness(palette['50']);
			const b100 = getBrightness(palette['100']);
			const b200 = getBrightness(palette['200']);
			const b300 = getBrightness(palette['300']);
			const b400 = getBrightness(palette['400']);
			const b500 = getBrightness(palette['500']);

			expect(b50).toBeGreaterThan(b100);
			expect(b100).toBeGreaterThan(b200);
			expect(b200).toBeGreaterThan(b300);
			expect(b300).toBeGreaterThan(b400);
			expect(b400).toBeGreaterThan(b500);
		});

		test('darker shades are progressively darker', () => {
			const palette = generatePalette('#486621');

			const getBrightness = (hex) => {
				const rgb = hexToRgb(hex);
				return (rgb.r + rgb.g + rgb.b) / 3;
			};

			const b500 = getBrightness(palette['500']);
			const b600 = getBrightness(palette['600']);
			const b700 = getBrightness(palette['700']);
			const b800 = getBrightness(palette['800']);
			const b900 = getBrightness(palette['900']);

			expect(b500).toBeGreaterThan(b600);
			expect(b600).toBeGreaterThan(b700);
			expect(b700).toBeGreaterThan(b800);
			expect(b800).toBeGreaterThan(b900);
		});

		test('works with shorthand hex', () => {
			const palette = generatePalette('#f00');
			expect(palette['500']).toBe('#f00');
			expect(Object.keys(palette).length).toBe(10);
		});

		test('falls back to default on invalid input', () => {
			const palette = generatePalette('invalid');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'Invalid hex color "invalid", falling back to "#486621"'
			);
			expect(palette['500']).toBe('#486621');
		});

		test('handles null fallback gracefully', () => {
			const palette = generatePalette('invalid', null);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Invalid hex color "invalid" and no fallback available'
			);
			// Should return a hardcoded palette
			expect(palette['500']).toBe('#486621');
			expect(Object.keys(palette).length).toBe(10);
		});

		test('uses custom fallback when provided', () => {
			const palette = generatePalette('invalid', '#ff0000');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'Invalid hex color "invalid", falling back to "#ff0000"'
			);
			expect(palette['500']).toBe('#ff0000');
		});

		test('all palette values are valid hex colors', () => {
			const palette = generatePalette('#486621');
			const hexRegex = /^#[0-9a-f]{6}$/i;

			Object.values(palette).forEach((value) => {
				expect(value).toMatch(hexRegex);
			});
		});
	});
});
