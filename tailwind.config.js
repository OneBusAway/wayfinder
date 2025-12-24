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
		extend:  {
			colors: {
				brand: process.env.PUBLIC_APP_PRIMARY_COLOR || '#78aa36',
				'brand-secondary': process.env.PUBLIC_APP_SECONDARY_COLOR || '#486621',
				// Custom UI colors for theming
				'nav-bg-light': process.env.PUBLIC_APP_NAV_BG_COLOR || '#ffffff',
				'nav-bg-dark': process.env.PUBLIC_APP_NAV_BG_COLOR_DARK || '#000000',
				'text-primary-light': process.env.PUBLIC_APP_TEXT_PRIMARY_COLOR || '#111827',
				'text-primary-dark': process. env.PUBLIC_APP_TEXT_PRIMARY_COLOR_DARK || '#ffffff',
				'border-custom-light': process.env.PUBLIC_APP_BORDER_COLOR || '#6b7280',
				'border-custom-dark': process. env.PUBLIC_APP_BORDER_COLOR_DARK || '#374151',
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

	plugins: [require('@tailwindcss/forms'), flowbitePlugin],
	darkMode: 'class'
};