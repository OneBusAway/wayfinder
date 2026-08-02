// Test-only helper: $state is a runes macro, so it only compiles inside a
// .svelte/.svelte.js module — a plain .test.js can't create the reactive proxy
// a $bindable prop writes back into. Mirrors support/reactiveStop.svelte.js.
export function createLayerBindings() {
	let routeStopIds = $state(new Map());
	let liveCounts = $state(new Map());
	return {
		get routeStopIds() {
			return routeStopIds;
		},
		set routeStopIds(value) {
			routeStopIds = value;
		},
		get liveCounts() {
			return liveCounts;
		},
		set liveCounts(value) {
			liveCounts = value;
		}
	};
}
