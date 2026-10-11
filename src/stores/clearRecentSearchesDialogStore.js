import { writable } from 'svelte/store';

const closedState = {
	open: false,
	onConfirm: null,
	returnFocusTo: null
};

export const clearRecentSearchesDialog = writable(closedState);

export function openClearRecentSearchesDialog({ onConfirm, returnFocusTo }) {
	clearRecentSearchesDialog.set({
		open: true,
		onConfirm,
		returnFocusTo
	});
}

export function closeClearRecentSearchesDialog() {
	let returnFocusTo;
	clearRecentSearchesDialog.update((state) => {
		returnFocusTo = state.returnFocusTo;
		return closedState;
	});
	return returnFocusTo;
}
