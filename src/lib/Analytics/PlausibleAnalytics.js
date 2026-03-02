import { env as dynamicEnv } from '$env/dynamic/public';

export class PlausibleAnalytics {
	constructor(env) {
		this.env = env || dynamicEnv;
		this.defaultProperties = {};
	}

	isEnabled() {
		return (
			this.env.PUBLIC_ANALYTICS_ENABLED === 'true' &&
			!!this.env.PUBLIC_ANALYTICS_DOMAIN &&
			!!this.env.PUBLIC_ANALYTICS_API_HOST
		);
	}

	getEventUrl() {
		return `${this.env.PUBLIC_ANALYTICS_API_HOST}/api/event`;
	}

	getDomain() {
		return this.env.PUBLIC_ANALYTICS_DOMAIN;
	}

	async forwardEvent({ name, url, referrer, props }) {
		if (!this.isEnabled()) {
			return { status: 'analytics disabled' };
		}

		if (!name || !url) {
			throw new Error('forwardEvent requires name and url');
		}

		const res = await fetch(this.getEventUrl(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				domain: this.getDomain(),
				name,
				url,
				referrer,
				props
			})
		});

		if (!res.ok) {
			const err = new Error(`Error sending event: ${res.statusText}`);
			err.upstreamStatus = res.status;
			throw err;
		}

		const text = await res.text();
		try {
			return JSON.parse(text);
		} catch {
			return { status: text };
		}
	}

	async postEvent(pageURL, eventName, props = {}) {
		if (!this.isEnabled()) {
			console.debug('Analytics disabled: skipping event');
			return;
		}

		const payload = {
			name: eventName,
			url: pageURL,
			props: this.buildProps(props)
		};

		try {
			console.debug('Sending event:', payload);
			const response = await fetch(`/api/events`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Error sending event: ${response.statusText}. ${errorText}`);
			}
			return response.json();
		} catch (error) {
			console.error('Error tracking event:', error);
			throw error;
		}
	}

	async reportPageView(pageURL, props = {}) {
		return this.postEvent(pageURL, 'pageview', props);
	}

	async reportSearchQuery(query) {
		return this.postEvent('/search', 'search', { query: query });
	}

	async reportStopViewed(id, stopDistance) {
		return this.postEvent('/stop', 'pageview', { id: id, distance: stopDistance });
	}

	async reportRouteClicked(routeId) {
		return this.postEvent('/route', 'click', { id: routeId });
	}

	async reportArrivalClicked(action) {
		return this.postEvent('/arrivals', 'click', { item_id: action });
	}

	buildProps(otherProps = {}) {
		return { ...this.defaultProperties, ...otherProps };
	}
}

const analytics = new PlausibleAnalytics();
export default analytics;
