import { describe, it, expect, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({ PUBLIC_COLOR_VEHICLE_HIGHLIGHT: '#FF0000' }));

vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockEnv;
	}
}));

import { createVehicleIconSvg } from '$lib/MapHelpers/generateVehicleIcon.js';

describe('createVehicleIconSvg with custom env color', () => {
	it('uses configured PUBLIC_COLOR_VEHICLE_HIGHLIGHT', () => {
		const svg = createVehicleIconSvg(0, '#007BFF', undefined, true);
		expect(svg).toContain('#FF0000');
		expect(svg).not.toContain('#FACC15');
	});
});
