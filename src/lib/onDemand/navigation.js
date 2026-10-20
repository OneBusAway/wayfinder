import { pushState } from '$app/navigation';
import { onDemandServicePath } from '$lib/urls';

/**
 * Open an on-demand service's sheet via shallow routing, so the map stays
 * mounted while the URL becomes the service's shareable path.
 * @param {string} serviceId Combined on-demand service id.
 */
export function openOnDemandService(serviceId) {
	// FIXME: navigation path not built with resolve()
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	pushState(onDemandServicePath(serviceId), { onDemandServiceId: serviceId });
}
