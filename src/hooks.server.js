import oba from '$lib/obaSdk.js';

let routesCache = null;

async function fetchRoutesData() {
	try {
		const agenciesResponse = await oba.agenciesWithCoverage.list();
		const agencies = agenciesResponse.data.list;

		const routesPromises = agencies.map(async (agency) => {
			const routesResponse = await oba.routesForAgency.list(agency.agencyId);
			const routes = routesResponse.data.list;
			const references = routesResponse.data.references;

			const agencyReferenceMap = new Map(references.agencies.map((agency) => [agency.id, agency]));

			routes.forEach((route) => {
				route.agencyInfo = agencyReferenceMap.get(route.agencyId);
			});

			return routes;
		});

		const routes = await Promise.all(routesPromises);
		return routes.flat();
	} catch (error) {
		console.error('Error fetching routes:', error);
		return null;
	}
}

async function preloadRoutesData() {
	if (!routesCache) {
		routesCache = await fetchRoutesData();
	}
}

preloadRoutesData();

export async function handle({ event, resolve }) {
	await preloadRoutesData();
	return resolve(event);
}

export function getRoutesCache() {
	return routesCache;
}
