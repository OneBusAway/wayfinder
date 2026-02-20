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
 * @returns {{fromPlace: string, toPlace: string, selectedFrom: Object|null, selectedTo: Object|null, fromMarker: Object|null, toMarker: Object|null}}
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
	const newFromPlace = toPlace;
	const newToPlace = fromPlace;
	const newSelectedFrom = selectedTo;
	const newSelectedTo = selectedFrom;

	// Remove existing markers if they exist
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
