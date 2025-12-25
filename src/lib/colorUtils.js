/**
 * Color utility functions for generating Tailwind color palettes
 * Used by tailwind.config.js to dynamically generate the primary color palette
 */

/**
 * Converts a hex color string to RGB object
 * Supports both 3-digit (#fff) and 6-digit (#ffffff) hex formats
 * @param {string} hex - Hex color string (with or without #)
 * @returns {{r: number, g: number, b: number} | null} RGB object or null if invalid
 */
export function hexToRgb(hex) {
	hex = hex.replace(/^#/, '');
	// Expand 3-digit hex to 6-digit
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((c) => c + c)
			.join('');
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
