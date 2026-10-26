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
	}
}

export {};
