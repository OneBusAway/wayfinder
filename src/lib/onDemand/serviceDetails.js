import { referencedLocationIds } from '$lib/onDemand/models.js';

/**
 * What the detail sheet's "Where" section shows. It is shown when the service
 * spans several areas or some rule drops off somewhere other than it picks up.
 * @param {import('./models.js').OnDemandService} service
 * @returns {{ show: boolean, serviceAreaNames: string[], serviceAreaCount: number, dropOffNames: string[] | null }}
 */
export function whereSummary(service) {
	const { refs } = service;
	const fromIds = unique(service.rules.flatMap((rule) => rule.fromIds));
	const areaCount = referencedLocationIds(service).filter((id) => refs.serviceAreas.has(id)).length;
	const differingRules = service.rules.filter((rule) => !sameSet(rule.fromIds, rule.toIds));

	const serviceAreaNames = fromIds
		.map((id) => refs.serviceAreas.get(id)?.name ?? refs.locationGroups.get(id)?.name ?? null)
		.filter(Boolean);
	const dropOffNames = differingRules.length
		? unique(differingRules.flatMap((rule) => rule.toIds))
				.map(
					(id) =>
						refs.serviceAreas.get(id)?.name ??
						refs.locationGroups.get(id)?.name ??
						refs.stops.get(id)?.name ??
						null
				)
				.filter(Boolean)
		: null;

	return {
		show: areaCount > 1 || differingRules.length > 0,
		serviceAreaNames,
		serviceAreaCount: fromIds.length,
		dropOffNames
	};
}

/**
 * @param {import('./models.js').OnDemandService} service
 * @returns {{ north: number, south: number, east: number, west: number } | null}
 */
export function serviceBounds(service) {
	const boxes = referencedLocationIds(service)
		.map((id) => service.refs.serviceAreas.get(id)?.bbox)
		.filter(Boolean);
	if (!boxes.length) return null;
	return {
		west: Math.min(...boxes.map((box) => box[0])),
		south: Math.min(...boxes.map((box) => box[1])),
		east: Math.max(...boxes.map((box) => box[2])),
		north: Math.max(...boxes.map((box) => box[3]))
	};
}

function unique(values) {
	return [...new Set(values)];
}

function sameSet(a, b) {
	const setA = new Set(a);
	const setB = new Set(b);
	return setA.size === setB.size && [...setA].every((value) => setB.has(value));
}
