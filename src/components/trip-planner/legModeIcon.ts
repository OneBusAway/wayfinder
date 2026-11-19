import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Footprints } from '@lucide/svelte';
import {
	faBus,
	faCableCar,
	faFerry,
	faTrain,
	faTrainSubway
} from '@fortawesome/free-solid-svg-icons';

/**
 * Icon for an OpenTripPlanner leg mode, shared by the itinerary tabs and the
 * leg timeline so they cannot disagree. Transit modes use the same Font Awesome
 * glyphs as `prioritizedRouteTypeForDisplay` does for the matching GTFS route
 * type; walking uses Lucide (see #643).
 *
 * @param mode OTP mode, e.g. "WALK", "BUS" or "SUBWAY"
 * @returns The icon to pass to `AppIcon`, or null for a mode with no icon
 */
export function getLegModeIcon(mode: string): typeof Footprints | IconDefinition | null {
	switch (mode) {
		case 'WALK':
			return Footprints;
		case 'BUS':
			return faBus;
		case 'TRAIN':
		case 'RAIL':
			return faTrain;
		case 'FERRY':
			return faFerry;
		case 'LIGHT_RAIL':
		case 'TRAM':
		case 'SUBWAY':
			return faTrainSubway;
		case 'CABLE_CAR':
		case 'GONDOLA':
		case 'FUNICULAR':
			return faCableCar;
		default:
			return null;
	}
}
