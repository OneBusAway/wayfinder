import { toDirection } from '$lib/mathUtils';

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

const color = '#007BFF';

const ARROW_PATHS = {
	north: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" />
    `, // 0 degrees
	northeast: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" transform="rotate(45, 20, 20)" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" transform="rotate(45, 20, 20)" />
    `, // 45 degrees
	east: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" transform="rotate(90, 20, 20)" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" transform="rotate(90, 20, 20)" />
    `, // 90 degrees
	southeast: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" transform="rotate(135, 20, 20)" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" transform="rotate(135, 20, 20)" />
    `, // 135 degrees
	south: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" transform="rotate(180, 20, 20)" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" transform="rotate(180, 20, 20)" />
    `, // 180 degrees
	southwest: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" transform="rotate(225, 20, 20)" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" transform="rotate(225, 20, 20)" />
    `, // 225 degrees
	west: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" transform="rotate(270, 20, 20)" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" transform="rotate(270, 20, 20)" />
    `, // 270 degrees
	northwest: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" transform="rotate(315, 20, 20)" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" transform="rotate(315, 20, 20)" />
    `, // 315 degrees
	default: `
        <line x1="20" y1="20" x2="20" y2="0" stroke="${color}" stroke-width="2" />
        <polygon points="20,-5 25,5 15,5" fill="${color}" stroke="white" stroke-width="1" />
    ` // Default direction
};

function getDirectionFromOrientation(orientation) {
	const nearestDirection = DIRECTIONS.reduce((prev, curr) =>
		Math.abs(curr.angle - orientation) < Math.abs(prev.angle - orientation) ? curr : prev
	);
	return nearestDirection.icon;
}

function createVehicleIconSvg(orientation) {
	const direction = getDirectionFromOrientation(toDirection(orientation));
	const arrowPath = ARROW_PATHS[direction] || ARROW_PATHS.default;

	const busIcon = `
        <!-- Main bus body -->
        <rect x="14" y="14" width="12" height="12" rx="2" ry="2" fill="${color}"/>
        <!-- Windows -->
        <rect x="16" y="18" width="2" height="2" fill="white"/>
        <rect x="22" y="18" width="2" height="2" fill="white"/>
        <!-- Bumper -->
        <rect x="17" y="22" width="6" height="1.5" fill="white"/>
        <!-- Wheels -->
        <circle cx="17" cy="26" r="1.5" fill="black"/>
        <circle cx="23" cy="26" r="1.5" fill="black"/>
    `;

	return `
        <svg width="40" height="40" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
            <!-- Directional arrow -->
            ${arrowPath}

            <!-- Circle background -->
            <circle cx="20" cy="20" r="13" stroke="${color}" stroke-width="2" fill="white"/>

            <!-- Bus icon inside the circle -->
            ${busIcon}
        </svg>`;
}

export { createVehicleIconSvg };
