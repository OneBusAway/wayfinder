import flowbitePlugin from 'flowbite/plugin';
import dotenv from 'dotenv';
import tinycolor from 'tinycolor2';

dotenv.config();

const basePrimary = process.env.PUBLIC_APP_PRIMARY_COLOR || '#78aa36';

console.log("PUBLIC_APP_PRIMARY_COLOR:", process.env.PUBLIC_APP_PRIMARY_COLOR);
console.log("PUBLIC_APP_SECONDARY_COLOR:", process.env.PUBLIC_APP_SECONDARY_COLOR);

/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'
	],

	theme: {
		extend: {
			colors: {
				brand: basePrimary,
				'brand-secondary': process.env.PUBLIC_APP_SECONDARY_COLOR || '#486621',
				primary: {
					50: tinycolor(basePrimary).lighten(40).toHexString(),
					100: tinycolor(basePrimary).lighten(30).toHexString(),
					200: tinycolor(basePrimary).lighten(20).toHexString(),
					300: tinycolor(basePrimary).lighten(10).toHexString(),
					400: tinycolor(basePrimary).lighten(5).toHexString(),
					500: basePrimary,
					600: tinycolor(basePrimary).darken(5).toHexString(),
					700: tinycolor(basePrimary).darken(10).toHexString(),
					800: tinycolor(basePrimary).darken(20).toHexString(),
					900: tinycolor(basePrimary).darken(30).toHexString()
				}
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
