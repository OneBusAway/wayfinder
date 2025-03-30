import flowbitePlugin from 'flowbite/plugin';
import dotenv from 'dotenv';

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
				brand: process.env.PUBLIC_APP_PRIMARY_COLOR || '#78aa36',
				'brand-secondary': process.env.PUBLIC_APP_SECONDARY_COLOR || '#486621',
				// flowbite-svelte
				primary: {
					50: '#FFF5F2',
					100: '#FFF1EE',
					200: '#FFE4DE',
					300: '#FFD5CC',
					400: '#FFBCAD',
					500: '#FE795D',
					600: '#EF562F',
					700: '#EB4F27',
					800: '#CC4522',
					900: '#A5371B'
				}
			},
			rotate: {
				135: '135deg',
				225: '225deg'
			}
		}
	},

	plugins: [require('@tailwindcss/forms'), flowbitePlugin , require('tailwind-scrollbar')],
	darkMode: 'class'
};
