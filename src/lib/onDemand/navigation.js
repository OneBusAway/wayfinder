import { pushState } from '$app/navigation';
import { onDemandServicePath } from '$lib/urls';

/**
 * Open an on-demand service's sheet via shallow routing, so the map stays
 * mounted while the URL becomes the service's shareable path.
 * @param {string} serviceId Combined on-demand service id.
 */
export function openOnDemandService(serviceId) {
	pushState(onDemandServicePath(serviceId), { onDemandServiceId: serviceId });
}
