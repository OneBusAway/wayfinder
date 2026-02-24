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

function createVehicleIconSvg(orientation, color = '#007BFF', routeType = RouteType.BUS) {
	const direction = getDirectionFromOrientation(toDirection(orientation));
	const angle = DIRECTIONS.find((d) => d.icon === direction).angle;

	const arrowPath = `
    <line x1="0" y1="0" x2="0" y2="-15" stroke-width="2" transform="rotate(${angle})"/>
    <polygon points="0,-25 5,-15 -5, -15" stroke="white" stroke-width="1" transform="rotate(${angle})"/>
`;

	const vehicleSvg = generateRouteTypeSvgForDisplay(routeType);

	return `
        <svg width="${iconWidth}" height="${iconHeight}" viewBox="-28 -28 56 56" xmlns="http://www.w3.org/2000/svg">
            <g stroke="${color}" fill="${color}">
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
