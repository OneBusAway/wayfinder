import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const REFRESH_INTERVAL = 30 * 1000; // 30 seconds

function compareArrivals(oldArrivals, newArrivals) {
	// Create ID sets for comparison
	const oldIds = new Set(oldArrivals.map((a) => a.tripId || a.id));
	const newIds = new Set(newArrivals.map((a) => a.tripId || a.id));

	// Find new arrivals
	const added = newArrivals.filter((a) => !oldIds.has(a.tripId || a.id));

	// Find removed arrivals
	const removed = oldArrivals.filter((a) => !newIds.has(a.tripId || a.id));

	return { added, removed };
}

function createArrivalUpdatesStore() {
	let refreshInterval = null;

	const isPolling = writable(false);
	const lastUpdated = writable(null);
	const newArrivals = writable([]);
	const removedArrivals = writable([]);
	const previousArrivals = writable([]);

	function startPolling(sid, fetchFn) {
		if (!browser) return;

		if (refreshInterval) {
			clearInterval(refreshInterval);
		}

		isPolling.set(true);

		// Initial fetch
		if (fetchFn) {
			fetchFn();
		}

		// Set up interval polling
		refreshInterval = setInterval(async () => {
			if (fetchFn) {
				try {
					await fetchFn();
					lastUpdated.set(new Date());
				} catch (error) {
					console.warn('[arrivalUpdatesStore] Error during auto-refresh:', error);
				}
			}
		}, REFRESH_INTERVAL);
	}

	function stopPolling() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}

		isPolling.set(false);
		newArrivals.set([]);
		removedArrivals.set([]);
	}

	function updateArrivals(oldArrivals, newArrivals_) {
		const { added, removed } = compareArrivals(oldArrivals || [], newArrivals_ || []);

		// Update stores with diff
		newArrivals.set(added);
		removedArrivals.set(removed);
		previousArrivals.set(newArrivals_);
		lastUpdated.set(new Date());
	}

	function clearDiff() {
		newArrivals.set([]);
		removedArrivals.set([]);
	}

	return {
		isPolling: { subscribe: isPolling.subscribe },
		lastUpdated: { subscribe: lastUpdated.subscribe },
		newArrivals: { subscribe: newArrivals.subscribe },
		removedArrivals: { subscribe: removedArrivals.subscribe },
		previousArrivals: { subscribe: previousArrivals.subscribe },
		startPolling,
		stopPolling,
		updateArrivals,
		clearDiff
	};
}

export const arrivalUpdatesStore = createArrivalUpdatesStore();
