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
// TODO: make this configurable via a COLOR_* env var (like the brand colors) so
// deployments can match it to their theme instead of the hardcoded amber.
const HIGHLIGHT_GLOW_COLOR = '#FACC15';

function createVehicleIconSvg(
	orientation,
	color = '#007BFF',
	routeType = RouteType.BUS,
	highlighted = false
) {
	const direction = getDirectionFromOrientation(toDirection(orientation));
	const angle = DIRECTIONS.find((d) => d.icon === direction).angle;

	const arrowPath = `
    <line x1="0" y1="0" x2="0" y2="-15" stroke-width="2" transform="rotate(${angle})"/>
    <polygon points="0,-25 5,-15 -5, -15" stroke="white" stroke-width="1" transform="rotate(${angle})"/>
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
            <g stroke="${color}" fill="${color}">
                <!-- Highlight glow for the selected vehicle (behind everything) -->
                ${highlightGlow}

                <!-- Directional arrow -->
                ${arrowPath}

                <!-- Circle background -->
                <circle cx="0" cy="0" r="13" stroke-width="2" fill="white"/>

                <!-- vehicle icon inside the circle -->
                ${vehicleSvg}
            </g>
        </svg>`;
}

export { createVehicleIconSvg, iconWidth, iconHeight };
