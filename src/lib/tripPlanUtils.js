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

/**
 * Determines if there is a stay-seated transition between two legs. That occurs when a
 * passenger stays on the same vehicle and it continues under a different id.
 * @see https://github.com/opentripplanner/OpenTripPlanner/pull/4264
 *
 * @param {Array} legs - The array of all legs in the trip
 * @param {number} index - The index of the current leg to check
 * @returns {boolean} True if the next leg is a stay-seated interline transition
 */
export function isStaySeatedTransition(legs, index) {
	const prev = legs[index];
	const next = legs[index + 1];
	if (!prev || !next) return false;
	if (prev.mode === 'WALK' || next.mode === 'WALK') return false;
	return (
		prev.mode === next.mode &&
		next.interlineWithPreviousLeg === true
	);
}
