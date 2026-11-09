// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface PageState {
			/** Stop entry carried through a shallow pushState marker tap. */
			stopData?: {
				id: string;
				lat: number;
				lon: number;
				name: string;
				[key: string]: unknown;
			};
		}
	}

	interface WindowEventMap {
		contextMenuTripPlan: CustomEvent<{ lat: number; lng: number; type: 'from' | 'to' }>;
		routeSelectedFromModal: CustomEvent<{
			route: import('onebusaway-sdk/resources/routes-for-location').RoutesForLocationListResponse.Data.List;
		}>;
		themeChange: CustomEvent<{ darkMode: boolean }>;
	}

	/** Build-time constants injected by `define` in vite.config.js. */
	const __OBA_LOGO_URL_DARK__: string;
	const __SHOW_REGION_NAME_IN_NAV_BAR__: boolean;
}

export {};
