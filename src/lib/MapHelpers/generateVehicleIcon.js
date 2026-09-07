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
 * Returns the neutral backing with the strongest contrast against the glyph
 * and arrow. The outer halo handles basemap contrast separately.
 *
 * @param {string} color
 * @returns {'#ffffff' | '#000000'}
 */
function getVehicleMarkerContrastColor(color) {
	return contrastRatio(color, '#ffffff') >= contrastRatio(color, '#000000') ? '#ffffff' : '#000000';
}

/**
 * Creates the SVG used for a live vehicle marker.
 *
 * @param {number} orientation
 * @param {string} [color='#007BFF']
 * @param {number} [routeType=RouteType.BUS]
 * @param {boolean} [highlighted=false]
 * @param {boolean} [dark=false]
 * @returns {string}
 */
function createVehicleIconSvg(
	orientation,
	color = '#007BFF',
	routeType = RouteType.BUS,
	highlighted = false,
	dark = false
) {
	const direction = getDirectionFromOrientation(toDirection(orientation));
	const angle = DIRECTIONS.find((d) => d.icon === direction).angle;
	const contrastColor = getVehicleMarkerContrastColor(color);
	// Keep a light silhouette on dark tiles without forcing pale glyphs onto
	// white. In light mode the route-coloured ring supplies the silhouette.
	const haloColor = dark ? '#ffffff' : contrastColor;
	const arrowHalo =
		haloColor !== contrastColor
			? `<line x1="0" y1="0" x2="0" y2="-15" stroke="${haloColor}" stroke-width="8" stroke-linecap="round" transform="rotate(${angle})"/>
    <polygon points="0,-25 5,-15 -5,-15" fill="${haloColor}" stroke="${haloColor}" stroke-width="6" stroke-linejoin="round" transform="rotate(${angle})"/>`
			: '';

	// Draw the route-coloured arrow over a contrasting outline, with an extra
	// outer halo when needed to distinguish that outline from the basemap.
	const arrowPath = `
    ${arrowHalo}
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
	// A solid halo ring sized well beyond the marker backing so it remains clearly
	// visible, softened with a blur. Drawn behind so the arrow/icon stay crisp.
	const highlightGlow = highlighted
		? `<circle cx="0" cy="0" r="23" fill="${HIGHLIGHT_GLOW_COLOR}" stroke="none" opacity="0.95" filter="url(#vehicle-highlight-blur)"/>`
		: '';

	const vehicleSvg = generateRouteTypeSvgForDisplay(routeType);

	return `
        <svg width="${iconWidth}" height="${iconHeight}" viewBox="-28 -28 56 56" xmlns="http://www.w3.org/2000/svg">
            ${highlightDefs}
            <!-- Highlight glow for the selected vehicle (behind everything) -->
            ${highlightGlow}

            <!-- Mask the route under the vehicle with a contrasting backing. -->
            <circle cx="0" cy="0" r="16" fill="${haloColor}"/>

            <g stroke="${color}" fill="${color}">
                <!-- Directional arrow -->
                ${arrowPath}

                <!-- Route-coloured ring; the fill masks the arrow shaft beneath the glyph. -->
                <circle cx="0" cy="0" r="13" stroke-width="2" fill="${contrastColor}"/>

                <!-- vehicle icon inside the circle -->
                ${vehicleSvg}
            </g>
        </svg>`;
}

export { createVehicleIconSvg, getVehicleMarkerContrastColor, iconWidth, iconHeight };
