import { env as dynamicEnv } from '$env/dynamic/public';

export class Analytics {
	constructor(env) {
		this.env = env || dynamicEnv;
		this.defaultProperties = {};
	}

	isEnabled() {
		const provider = this.env.PUBLIC_ANALYTICS_PROVIDER;
		return !!provider && provider !== 'none';
	}
}
