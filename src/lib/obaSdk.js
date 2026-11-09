import onebusaway from 'onebusaway-sdk';
import { PUBLIC_OBA_SERVER_URL as baseURL } from '$env/static/public';
import { PRIVATE_OBA_API_KEY as apiKey } from '$env/static/private';
import { error, json } from '@sveltejs/kit';

const oba = new onebusaway({
	baseURL,
	apiKey,
	// Some servers (e.g. MTA BusTime) default to the v1 response shape without this.
	defaultQuery: { version: 2 }
});

export function handleOBAResponse(response, entityName) {
	if (!response) {
		throw error(500, `Unable to fetch ${entityName}.`);
	}

	if (typeof response.code === 'undefined') {
		throw error(500, `Unable to fetch ${entityName}.`);
	}

	if (response.code !== 200) {
		throw error(500, `Unable to fetch ${entityName}.`);
	}

	return json(response);
}

export default oba;
