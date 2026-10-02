import { BusFront, CableCar, Ship, TrainFrontTunnel, TramFront } from '@lucide/svelte';
import {
	BusFront as BusFrontNodes,
	CableCar as CableCarNodes,
	Ship as ShipNodes,
	TrainFrontTunnel as TrainFrontTunnelNodes,
	TramFront as TramFrontNodes
} from 'lucide';

const RouteType = {
	LIGHT_RAIL: 0,
	SUBWAY: 1,
	RAIL: 2,
	BUS: 3,
	FERRY: 4,
	CABLE_CAR: 5,
	GONDOLA: 6,
	FUNICULAR: 7,
	UNKNOWN: 999
};

// Stop markers show their route-name labels at this map zoom level and closer.
const SHOW_ROUTE_LABELS_AT_ZOOM = 17;

const routePriorities = [
	RouteType.FERRY,
	RouteType.LIGHT_RAIL,
	RouteType.SUBWAY,
	RouteType.RAIL,
	RouteType.BUS,
	RouteType.CABLE_CAR,
	RouteType.GONDOLA,
	RouteType.FUNICULAR,
	RouteType.UNKNOWN
];

const routeTypeIcons = {
	[RouteType.FERRY]: { component: Ship, nodes: ShipNodes },
	[RouteType.LIGHT_RAIL]: { component: TrainFrontTunnel, nodes: TrainFrontTunnelNodes },
	[RouteType.SUBWAY]: { component: TrainFrontTunnel, nodes: TrainFrontTunnelNodes },
	[RouteType.RAIL]: { component: TramFront, nodes: TramFrontNodes },
	[RouteType.CABLE_CAR]: { component: CableCar, nodes: CableCarNodes },
	[RouteType.GONDOLA]: { component: CableCar, nodes: CableCarNodes },
	[RouteType.FUNICULAR]: { component: CableCar, nodes: CableCarNodes },
	[RouteType.BUS]: { component: BusFront, nodes: BusFrontNodes },
	[RouteType.UNKNOWN]: { component: BusFront, nodes: BusFrontNodes }
};

const defaultRouteTypeIcon = routeTypeIcons[RouteType.UNKNOWN];

/**
 * Lucide Svelte component for a GTFS route type (used by stop markers / search).
 * @param {number} routeType
 * @returns {import('svelte').Component}
 */
const prioritizedRouteTypeForDisplay = (routeType) => {
	return (routeTypeIcons[routeType] ?? defaultRouteTypeIcon).component;
};

/**
 * Serialize Lucide icon nodes into a compact inline SVG for vehicle markers.
 * Stroke-based (fill none) so the parent vehicle SVG can color via `stroke`.
 * @param {Array<[string, Record<string, string>]>} nodes
 * @param {number} [size]
 * @returns {string}
 */
function iconNodesToSvg(nodes, size = 18) {
	const inner = nodes
		.map(([tag, attrs]) => {
			const attrStr = Object.entries(attrs)
				.filter(([key]) => key !== 'key')
				.map(([key, value]) => `${key}="${value}"`)
				.join(' ');
			return `<${tag} ${attrStr} fill="none"/>`;
		})
		.join('');
	const half = size / 2;
	// Inherit stroke from the vehicle marker <g> so route color still applies.
	// 2.75 reads closer to the old filled FA glyphs at this small size.
	return `<svg x="${-half}" y="${-half}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="inherit" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const generateRouteTypeSvgForDisplay = (routeType) => {
	const nodes = (routeTypeIcons[routeType] ?? defaultRouteTypeIcon).nodes;
	return iconNodesToSvg(nodes);
};

export {
	RouteType,
	routePriorities,
	prioritizedRouteTypeForDisplay,
	generateRouteTypeSvgForDisplay,
	SHOW_ROUTE_LABELS_AT_ZOOM
};
