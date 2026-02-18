/**
 * Swaps two values using a temporary variable
 * @template T
 * @param {T} a - First value
 * @param {T} b - Second value
 * @returns {{first: T, second: T}} Object with swapped values
 */
export function swapValues(a, b) {
	return { first: b, second: a };
}

/**
 * Swaps trip planner locations (text, coordinates, and map markers)
 * @param {Object} params - Swap parameters
 * @param {string} params.fromPlace - Origin location text
 * @param {string} params.toPlace - Destination location text
 * @param {Object|null} params.selectedFrom - Origin coordinates
 * @param {Object|null} params.selectedTo - Destination coordinates
 * @param {Object|null} params.fromMarker - Origin map marker
 * @param {Object|null} params.toMarker - Destination map marker
 * @param {Object} params.mapProvider - Map provider instance
 * @param {Function} params.t - Translation function
 * @returns {Object} Swapped values
 */
export function swapTripLocations({
	fromPlace,
	toPlace,
	selectedFrom,
	selectedTo,
	fromMarker,
	toMarker,
	mapProvider,
	t
}) {
	// Swap text values
	const { first: newFromPlace, second: newToPlace } = swapValues(fromPlace, toPlace);

	// Swap coordinates
	const { first: newSelectedFrom, second: newSelectedTo } = swapValues(selectedFrom, selectedTo);

	// Remove existing markers (both providers are null-safe)
	if (fromMarker) mapProvider.removePinMarker(fromMarker);
	if (toMarker) mapProvider.removePinMarker(toMarker);

	// Re-add with swapped positions
	const newFromMarker = newSelectedFrom
		? mapProvider.addPinMarker(newSelectedFrom, t('trip-planner.from'))
		: null;
	const newToMarker = newSelectedTo
		? mapProvider.addPinMarker(newSelectedTo, t('trip-planner.to'))
		: null;

	return {
		fromPlace: newFromPlace,
		toPlace: newToPlace,
		selectedFrom: newSelectedFrom,
		selectedTo: newSelectedTo,
		fromMarker: newFromMarker,
		toMarker: newToMarker
	};
}
