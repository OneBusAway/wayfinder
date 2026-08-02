// Test-only helper: $state is a runes macro, so it's only usable inside a
// .svelte/.svelte.js module — a plain .test.js file can't create a reactive
// proxy directly. This mirrors the shape of the marker-supplied stopData
// that MapExperience's handleStopMarkerSelect receives in production.
export function createReactiveStop(data) {
	let stop = $state(data);
	return stop;
}
