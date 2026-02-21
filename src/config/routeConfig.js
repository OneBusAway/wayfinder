import {
	faBus,
	faFerry,
	faTrainSubway,
	faTrain,
	faCableCar
} from '@fortawesome/free-solid-svg-icons';

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

const prioritizedRouteTypeForDisplay = (routeType) => {
	switch (routeType) {
		case RouteType.FERRY:
			return faFerry;
		case RouteType.LIGHT_RAIL:
		case RouteType.SUBWAY:
			return faTrainSubway;
		case RouteType.RAIL:
			return faTrain;
		case RouteType.CABLE_CAR:
		case RouteType.GONDOLA:
		case RouteType.FUNICULAR:
			return faCableCar;
		default:
			return faBus;
	}
};

const generateRouteTypeSvgForDisplay = (routeType) => {
	const faIcon = prioritizedRouteTypeForDisplay(routeType);
	const { icon } = faIcon;
	const [width, height, , , pathData] = icon;
	const svgWidth = width / 32;
	const svgHeight = height / 32;
	const svgX = -svgWidth / 2;
	const svgY = -svgHeight / 2;

	return `
		<svg x="${svgX}" y="${svgY}" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${width} ${height}">
			<path d="${pathData}" />
		</svg>
	`;
};

export {
	RouteType,
	routePriorities,
	prioritizedRouteTypeForDisplay,
	generateRouteTypeSvgForDisplay
};
