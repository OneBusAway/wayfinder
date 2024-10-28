import oba from '$lib/obaSdk.js';

// TODO: change this api after deployment of get all routes api
export async function GET() {
	try {
		const agenciesResponse = await oba.agenciesWithCoverage.list();

		const agencies = agenciesResponse.data.list;

		const routesPromises = agencies.map(async (agency) => {
			const routesResponse = await oba.routesForAgency.list(agency.agencyId);
			const routes = routesResponse.data.list;
			const references = routesResponse.data.references;

			// mapping agency id to agency object for faster lookup
			const agencyReferenceMap = new Map(references.agencies.map((agency) => [agency.id, agency]));

			// mapping agency reference to each route
			routes.forEach((route) => {
				route.agencyInfo = agencyReferenceMap.get(route.agencyId);
			});

			return routes;
		});

		const routes = await Promise.all(routesPromises);
		const flattenedRoutes = routes.flat();

		return new Response(JSON.stringify({ routes: flattenedRoutes }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error fetching data:', error);
		return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
			headers: { 'Content-Type': 'application/json' },
			status: 500
		});
	}
}
