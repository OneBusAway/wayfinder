import { env } from '$env/dynamic/public';
import { contrastRatio } from '$lib/colorUtils.js';
import { toDirection } from '$lib/mathUtils';
import { generateRouteTypeSvgForDisplay, RouteType } from '$config/routeConfig';

const iconWidth = 56;
const iconHeight = 56;

const DIRECTIONS = [
	{ angle: 0, icon: 'north' },
	{ angle: 45, icon: 'northeast' },
	{ angle: 90, icon: 'east' },
	{ angle: 135, icon: 'southeast' },
	{ angle: 180, icon: 'south' },
	{ angle: 225, icon: 'southwest' },
	{ angle: 270, icon: 'west' },
	{ angle: 315, icon: 'northwest' }
];

function getDirectionFromOrientation(orientation) {
	const nearestDirection = DIRECTIONS.reduce((prev, curr) =>
		Math.abs(curr.angle - orientation) < Math.abs(prev.angle - orientation) ? curr : prev
	);
	return nearestDirection.icon;
}

// Soft glow drawn behind the vehicle the user selected (the trip they clicked).
// Configurable via PUBLIC_COLOR_VEHICLE_HIGHLIGHT env var so deployments can
// match it to their theme instead of the hardcoded amber.
const HIGHLIGHT_GLOW_COLOR = env.PUBLIC_COLOR_VEHICLE_HIGHLIGHT || '#FACC15';

/**
 * Returns the neutral colour that has the strongest contrast against the
 * vehicle/route colour. The vehicle marker deliberately keeps the route colour
 * for recognition, but this backing prevents it from disappearing into a
 * same-colour route polyline.
 *
 * @param {string} color
 * @returns {'#ffffff' | '#000000'}
 */
function getVehicleMarkerContrastColor(color) {
	return contrastRatio(color, '#ffffff') >= contrastRatio(color, '#000000') ? '#ffffff' : '#000000';
}

function createVehicleIconSvg(
	orientation,
	color = '#007BFF',
	routeType = RouteType.BUS,
	highlighted = false
) {
	const direction = getDirectionFromOrientation(toDirection(orientation));
	const angle = DIRECTIONS.find((d) => d.icon === direction).angle;
	const contrastColor = getVehicleMarkerContrastColor(color);

	// Draw the directional arrow twice: a broad neutral stroke first, then the
	// route-coloured arrow. This makes the direction indicator legible even
	// when it lies directly over a route of the same colour.
	const arrowPath = `
    <line x1="0" y1="0" x2="0" y2="-15" stroke="${contrastColor}" stroke-width="6" stroke-linecap="round" transform="rotate(${angle})"/>
    <polygon points="0,-25 5,-15 -5,-15" fill="${contrastColor}" stroke="${contrastColor}" stroke-width="4" stroke-linejoin="round" transform="rotate(${angle})"/>
    <line x1="0" y1="0" x2="0" y2="-15" stroke="${color}" stroke-width="2" stroke-linecap="round" transform="rotate(${angle})"/>
    <polygon points="0,-25 5,-15 -5,-15" fill="${color}" stroke="${color}" stroke-width="1" stroke-linejoin="round" transform="rotate(${angle})"/>
`;

	// A soft blurred halo behind the marker for the selected trip. Drawn first so
	// the arrow and icon render crisply on top (no hard ring clashing with the
	// arrow), leaving just a gentle glow around the marker.
	const highlightDefs = highlighted
		? `<defs><filter id="vehicle-highlight-blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>`
		: '';
	// A solid halo ring sized well beyond the white circle so it's clearly
	// visible, softened with a blur. Drawn behind so the arrow/icon stay crisp.
	const highlightGlow = highlighted
		? `<circle cx="0" cy="0" r="20" fill="${HIGHLIGHT_GLOW_COLOR}" stroke="none" opacity="0.95" filter="url(#vehicle-highlight-blur)"/>`
		: '';

	const vehicleSvg = generateRouteTypeSvgForDisplay(routeType);

	return `
        <svg width="${iconWidth}" height="${iconHeight}" viewBox="-28 -28 56 56" xmlns="http://www.w3.org/2000/svg">
            ${highlightDefs}
            <!-- Highlight glow for the selected vehicle (behind everything) -->
            ${highlightGlow}

            <!-- Mask the route under the vehicle with a contrasting backing. -->
            <circle cx="0" cy="0" r="16" fill="${contrastColor}"/>

            <g stroke="${color}" fill="${color}">
                <!-- Directional arrow -->
                ${arrowPath}

                <!-- Circle background -->
                <circle cx="0" cy="0" r="13" stroke-width="2" fill="${contrastColor}"/>

                <!-- vehicle icon inside the circle -->
                ${vehicleSvg}
            </g>
        </svg>`;
}

export { createVehicleIconSvg, getVehicleMarkerContrastColor, iconWidth, iconHeight };
