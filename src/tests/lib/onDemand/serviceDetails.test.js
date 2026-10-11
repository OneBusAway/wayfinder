import { describe, it, expect } from 'vitest';
import { whereSummary, serviceBounds } from '$lib/onDemand/serviceDetails.js';
import { parsedService, referencesJson, ruleJson, square } from '../../fixtures/onDemand.js';

const twoZones = referencesJson({
	serviceAreas: [
		{
			id: 'zone_a',
			name: 'West End',
			bbox: [-77.14, 38.79, -77.05, 38.84],
			geometry: square(-77.14, 38.79, -77.05, 38.84)
		},
		{
			id: 'zone_b',
			name: null,
			bbox: [-77.2, 38.7, -77.1, 38.8],
			geometry: square(-77.2, 38.7, -77.1, 38.8)
		}
	],
	locationGroups: [{ id: 'grp', name: 'Hospitals', stopIds: ['s1'] }]
});

describe('whereSummary', () => {
	it('is hidden for a single-area zone service', () => {
		expect(whereSummary(parsedService()).show).toBe(false);
	});

	it('shows zone-to-zone drop-off names and counts unnamed areas', () => {
		const service = parsedService(
			{ rules: [ruleJson({ fromIds: ['zone_a'], toIds: ['zone_b', 'grp'] })] },
			twoZones
		);
		expect(whereSummary(service)).toEqual({
			show: true,
			serviceAreaNames: ['West End'],
			serviceAreaCount: 1,
			dropOffNames: ['Hospitals']
		});
	});

	it('shows for a multi-area service with identical from and to', () => {
		const service = parsedService(
			{ rules: [ruleJson({ fromIds: ['zone_a', 'zone_b'], toIds: ['zone_b', 'zone_a'] })] },
			twoZones
		);
		const summary = whereSummary(service);
		expect(summary.show).toBe(true);
		expect(summary.serviceAreaCount).toBe(2);
		expect(summary.dropOffNames).toBeNull();
	});
});

describe('serviceBounds', () => {
	it('unions the bboxes of the referenced areas', () => {
		const service = parsedService(
			{ rules: [ruleJson({ fromIds: ['zone_a'], toIds: ['zone_b'] })] },
			twoZones
		);
		expect(serviceBounds(service)).toEqual({
			west: -77.2,
			south: 38.7,
			east: -77.05,
			north: 38.84
		});
	});

	it('is null when no area has a bbox', () => {
		expect(serviceBounds(parsedService({}, referencesJson({ serviceAreas: [] })))).toBeNull();
	});
});
