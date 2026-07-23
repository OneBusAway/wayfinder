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
}

export {};
