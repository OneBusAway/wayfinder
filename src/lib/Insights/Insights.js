import { env as dynamicEnv } from '$env/dynamic/public';
import { upstreamError } from './upstreamError.js';

/**
 * Provider-agnostic facade. Builds an AnalyticsEnvelope and POSTs it to /api/events.
 * Adapter selection happens on the server inside /api/events; the facade only knows
 * whether analytics is on or off.
 */
export class Analytics {
	constructor(env) {
		this.env = env || dynamicEnv;
		this.defaultProperties = {};
	}

	isEnabled() {
		const provider = this.env.PUBLIC_ANALYTICS_PROVIDER;
		return !!provider && provider !== 'none';
	}

	collectBrowserContext() {
		if (typeof window === 'undefined') {
			return { referrer: '', title: '', language: '', screen: '' };
		}
		return {
			referrer: typeof document !== 'undefined' ? document.referrer : '',
			title: typeof document !== 'undefined' ? document.title : '',
			language: typeof navigator !== 'undefined' ? navigator.language : '',
			screen: window.screen ? `${window.screen.width}x${window.screen.height}` : ''
		};
	}

	buildProps(otherProps = {}) {
		return { ...this.defaultProperties, ...otherProps };
	}

	buildEnvelope(pageURL, eventName, props) {
		return {
			name: eventName,
			url: pageURL,
			...this.collectBrowserContext(),
			props: this.buildProps(props)
		};
	}

	async postEvent(pageURL, eventName, props = {}) {
		if (!this.isEnabled()) {
			return;
		}

		if (!eventName || !pageURL) {
			throw new Error('postEvent requires name and url');
		}

		const envelope = this.buildEnvelope(pageURL, eventName, props);
		const body = JSON.stringify(envelope);

		if (
			typeof document !== 'undefined' &&
			document.visibilityState === 'hidden' &&
			typeof navigator !== 'undefined' &&
			typeof navigator.sendBeacon === 'function'
		) {
			const blob = new Blob([body], { type: 'application/json' });
			if (navigator.sendBeacon('/api/events', blob)) {
				return;
			}
		}

		// Call sites are fire-and-forget; swallow + log so analytics failures
		// never surface as unhandled promise rejections to the caller.
		try {
			const response = await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body
			});

			if (!response.ok) {
				throw await upstreamError(response);
			}
			return response.json();
		} catch (error) {
			console.error('Analytics error:', error);
		}
	}

	async reportPageView(pageURL, props = {}) {
		return this.postEvent(pageURL, 'pageview', props);
	}

	async reportSearchQuery(query) {
		return this.postEvent('/search', 'search', { query });
	}

	async reportStopViewed(id, distance) {
		return this.postEvent('/stop', 'pageview', { id, distance });
	}

	async reportRouteClicked(routeId) {
		return this.postEvent('/route', 'click', { id: routeId });
	}

	async reportArrivalClicked(action) {
		return this.postEvent('/arrivals', 'click', { item_id: action });
	}
}
