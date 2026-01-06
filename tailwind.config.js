import flowbitePlugin from 'flowbite/plugin';
import dotenv from 'dotenv';
import { generatePalette } from './src/lib/colorUtils.js';

dotenv.config();

/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'
	],

	theme: {
		extend: {
			colors: {
				brand: process.env.COLOR_BRAND_PRIMARY || '#78aa36',
				'brand-foreground': process.env.COLOR_BRAND_PRIMARY_FOREGROUND || '#ffffff',
				'brand-accent': process.env.COLOR_BRAND_ACCENT || '#486621',

				// Surfaces (panels, page backgrounds, etc.)
				// the foreground color is the text color that goes on top of the surface
				// and must have good contrast with the background.
				surface: process.env.COLOR_SURFACE || '#ffffff',
				'surface-foreground': process.env.COLOR_SURFACE_FOREGROUND || '#000000',

				'surface-dark': '#111827',
				'surface-foreground-dark': '#ffffff',

				// flowbite-svelte - dynamically generated from brand accent color
				primary: generatePalette(process.env.COLOR_BRAND_ACCENT || '#486621')
			},
			rotate: {
				135: '135deg',
				225: '225deg'
			}
		}
	},

	plugins: [require('@tailwindcss/forms'), flowbitePlugin],
	darkMode: 'class'
};
