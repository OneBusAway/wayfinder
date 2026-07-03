import { NoopAdapter } from './adapters/NoopAdapter.js';
import { PlausibleAdapter } from './adapters/PlausibleAdapter.js';
import { UmamiAdapter } from './adapters/UmamiAdapter.js';

export function createAdapter(env) {
	switch (env.PUBLIC_ANALYTICS_PROVIDER) {
		case 'plausible':
			return new PlausibleAdapter(env);
		case 'umami':
			return new UmamiAdapter(env);
		default:
			return new NoopAdapter();
	}
}
