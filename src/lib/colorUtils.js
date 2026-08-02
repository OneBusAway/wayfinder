/**
 * Color utility functions for generating Tailwind color palettes
 * Used by tailwind.config.js to dynamically generate the primary color palette
 */

import { COLORS } from './colors.js';

/**
 * Converts a hex color string to RGB object
 * Supports 3-digit (#fff), 6-digit (#ffffff) and 8-digit (#ffffffff) hex formats
 * @param {string} hex - Hex color string (with or without #)
 * @returns {{r: number, g: number, b: number} | null} RGB object or null if invalid
 */
export function hexToRgb(hex) {
	if (!hex || typeof hex !== 'string') return null;
	hex = hex.replace(/^#/, '');
	// Expand 3-digit hex to 6-digit
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((c) => c + c)
			.join('');
	}
	// ignore alpha channel in 8-digit hex
	if (hex.length === 8) {
		hex = hex.slice(0, 6);
	}

	const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16),
				g: parseInt(result[2], 16),
				b: parseInt(result[3], 16)
			}
		: null;
}

/**
 * Converts RGB values to hex color string
 * Values are clamped to 0-255 range
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} Hex color string (e.g., "#ff0000")
 */
export function rgbToHex(r, g, b) {
	const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
	return '#' + [r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('');
}

/**
 * Mixes two colors together based on weight
 * @param {{r: number, g: number, b: number}} color1 - First color
 * @param {{r: number, g: number, b: number}} color2 - Second color
 * @param {number} weight - Mix weight (0 = all color1, 1 = all color2)
 * @returns {{r: number, g: number, b: number}} Mixed color
 */
export function mixColors(color1, color2, weight) {
	return {
		r: color1.r + (color2.r - color1.r) * weight,
		g: color1.g + (color2.g - color1.g) * weight,
		b: color1.b + (color2.b - color1.b) * weight
	};
}

/**
 * Generates a 10-shade color palette from a base hex color
 * The base color becomes shade 500
 * Lighter shades (50-400) are mixed with white
 * Darker shades (600-900) are mixed with black
 *
 * @param {string} baseHex - Base hex color (becomes shade 500)
 * @param {string|null} fallbackHex - Fallback hex color if baseHex is invalid (prevents infinite recursion when null)
 * @returns {Object} Palette object with shades 50-900
 */
export function generatePalette(baseHex, fallbackHex = '#486621') {
	const base = hexToRgb(baseHex);
	if (!base) {
		if (fallbackHex === null) {
			// Prevent infinite recursion - return a hardcoded palette
			console.error(`Invalid hex color "${baseHex}" and no fallback available`);
			return {
				50: '#f4f6f1',
				100: '#e9eddf',
				200: '#c8d4b0',
				300: '#a6bb81',
				400: '#779251',
				500: '#486621',
				600: '#3d571c',
				700: '#324817',
				800: '#273912',
				900: '#1c290d'
			};
		}
		console.warn(`Invalid hex color "${baseHex}", falling back to "${fallbackHex}"`);
		return generatePalette(fallbackHex, null);
	}

	const white = { r: 255, g: 255, b: 255 };
	const black = { r: 0, g: 0, b: 0 };

	// Lighter shades (mix with white)
	// 50 is very light, 400 is slightly lighter than 500
	const lightWeights = { 50: 0.95, 100: 0.9, 200: 0.75, 300: 0.6, 400: 0.3 };

	// Darker shades (mix with black)
	// 600 is slightly darker, 900 is very dark
	const darkWeights = { 600: 0.15, 700: 0.3, 800: 0.45, 900: 0.6 };

	const palette = { 500: baseHex };

	for (const [shade, weight] of Object.entries(lightWeights)) {
		const mixed = mixColors(base, white, weight);
		palette[shade] = rgbToHex(mixed.r, mixed.g, mixed.b);
	}

	for (const [shade, weight] of Object.entries(darkWeights)) {
		const mixed = mixColors(base, black, weight);
		palette[shade] = rgbToHex(mixed.r, mixed.g, mixed.b);
	}

	return palette;
}

/**
 * Darkens a color by mixing it with black
 * @param {string} hexColor - Original hex color (e.g., "#486621")
 * @param {number} amount - Amount to darken (0-1, where 1 is pure black)
 * @returns {string} Darkened hex color
 */
export function darkenColor(hexColor, amount, fallbackHex = '#486621') {
	const rgb = hexToRgb(hexColor);
	if (!rgb) {
		if (fallbackHex === null) {
			console.error(`Invalid hex color "${hexColor}" and no fallback available`);
			return '#000000';
		}
		console.warn(`Invalid hex color "${hexColor}", falling back to "${fallbackHex}"`);
		return darkenColor(fallbackHex, amount, null);
	}

	const black = { r: 0, g: 0, b: 0 };
	const darkened = mixColors(rgb, black, amount);

	return rgbToHex(darkened.r, darkened.g, darkened.b);
}

/**
 * Lightens a color by mixing it with white
 * Simple and clear implementation for better visibility in dark mode
 * @param {string} hexColor - Original hex color (e.g., "#ff0000")
 * @param {number} amount - Amount to lighten (0-1, where 1 is pure white)
 * @returns {string} Lightened hex color
 */
export function lightenColor(hexColor, amount, fallbackHex = '#486621') {
	const rgb = hexToRgb(hexColor);
	if (!rgb) {
		if (fallbackHex === null) {
			console.error(`Invalid hex color "${hexColor}" and no fallback available`);
			return '#ffffff';
		}
		console.warn(`Invalid hex color "${hexColor}", falling back to "${fallbackHex}"`);
		return lightenColor(fallbackHex, amount, null);
	}

	const white = { r: 255, g: 255, b: 255 };
	const lightened = mixColors(rgb, white, amount);

	return rgbToHex(lightened.r, lightened.g, lightened.b);
}

/**
 * Calculates perceived brightness of a color (0-255)
 * Uses standard luminance formula
 * @param {{r: number, g: number, b: number}} rgb - RGB color object
 * @returns {number} Brightness value (0-255)
 */
export function getBrightness(rgb) {
	if (!rgb) return 0;
	// Standard luminance formula
	return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/**
 * Computes the WCAG 2.x contrast ratio between two colors, per the W3C
 * formula (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio): each channel is
 * gamma-corrected into linear light, combined into a relative luminance, and
 * the two luminances are compared as (lighter + 0.05) / (darker + 0.05).
 *
 * This is a different computation from `getBrightness` above, and the two are
 * NOT interchangeable — do not reach for `getBrightness` when the question is
 * "will this text be readable". `getBrightness` uses NTSC luma weights (R
 * .299 / G .587 / B .114), a formula for perceived brightness on 1950s analog
 * television, applied to raw (non-gamma-corrected) channel values. WCAG's
 * relative-luminance weights are different (R .2126 / G .7152 / B .0722,
 * applied after gamma-correcting each channel) because the eye's contrast
 * sensitivity is dominated by green and much less by red or blue. The two
 * formulas disagree often enough to matter: a dense sweep of real route
 * colors through an NTSC-brightness threshold mis-picked readable text color
 * on 14.4% of combinations (worst case `#00eb0f`, which reads "bright" under
 * NTSC luma but clears only 1.63:1 against white — far below the 4.5:1 WCAG
 * AA minimum for text). Anything deciding whether text is legible against a
 * background must use `contrastRatio`, not `getBrightness`.
 *
 * @param {string} hexA - First hex color, with or without leading '#'
 * @param {string} hexB - Second hex color, with or without leading '#'
 * @returns {number} Contrast ratio from 1 (identical luminance) to 21 (black
 *   vs. white). Returns 1 if either color fails to parse.
 */
export function contrastRatio(hexA, hexB) {
	const relativeLuminance = (hex) => {
		const rgb = hexToRgb(hex);
		if (!rgb) return null;
		const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
			const c = channel / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};

	const lumA = relativeLuminance(hexA);
	const lumB = relativeLuminance(hexB);
	if (lumA === null || lumB === null) return 1;

	const [lighter, darker] = lumA >= lumB ? [lumA, lumB] : [lumB, lumA];
	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Adjusts a color for better visibility in dark mode
 * Method: lightens dark colors by mixing with white
 * @param {string} hexColor - Original hex color (e.g., "#ff0000")
 * @returns {string} Adjusted hex color for dark mode
 */
export function adjustColorForDarkMode(hexColor) {
	if (!hexColor) return '#ffffff';

	const rgb = hexToRgb(hexColor);
	if (!rgb) return '#ffffff';

	const brightness = getBrightness(rgb);

	let category;
	if (brightness < 100) {
		category = 'very-dark';
	} else if (brightness < 150) {
		category = 'dark';
	} else if (brightness < 180) {
		category = 'somewhat-dark';
	} else {
		category = 'bright';
	}

	switch (category) {
		case 'very-dark':
			return lightenColor(hexColor, 0.5); // Mix 50% with white
		case 'dark':
			return lightenColor(hexColor, 0.35); // Mix 35% with white
		case 'somewhat-dark':
			return lightenColor(hexColor, 0.2); // Mix 20% with white
		case 'bright':
		default:
			return hexColor;
	}
}

/**
 * Resolves an OBA route color into a map-legible hex color.
 * - Returns null for missing/invalid input so callers keep their own default.
 * - Dark mode: lightens dark colors (via adjustColorForDarkMode) so they read
 *   against dark/night map tiles.
 * - Light mode: darkens very-bright colors (white, pale yellow) so they stay
 *   visible on the near-white light basemap.
 *
 * The 200 brightness threshold is deliberately more conservative than the 180
 * "bright" cutoff adjustColorForDarkMode uses internally — they are not the
 * same constant.
 * @param {string} rawColor - OBA hex, with or without a leading '#'
 * @param {{ dark?: boolean }} [opts]
 * @returns {string | null} Normalized, contrast-adjusted '#rrggbb', or null
 */
export function mapContrastColor(rawColor, { dark = false } = {}) {
	const rgb = hexToRgb(rawColor);
	if (!rgb) return null;

	const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

	if (dark) {
		return adjustColorForDarkMode(hex);
	}

	// Light mode: pull pale colors down so they don't vanish on the light basemap.
	if (getBrightness(rgb) > 200) {
		return darkenColor(hex, 0.45);
	}

	return hex;
}

/**
 * Color for a polyline's direction arrows. Darkens the line color so the arrows
 * stay distinct against the line; falls back to the default blue arrow color
 * when the line has no route color.
 * @param {string} lineColor - The polyline's resolved color (hex), or falsy
 * @returns {string} Arrow hex color
 */
export function polylineArrowColor(lineColor) {
	return lineColor ? darkenColor(lineColor, 0.25) : COLORS.POLYLINE_ARROW_STROKE;
}
