import { beforeEach, describe, expect, it } from 'vitest';
import {
	clearRecentSearchesDialog,
	closeClearRecentSearchesDialog,
	openClearRecentSearchesDialog
} from '../clearRecentSearchesDialogStore.js';

function getStoreValue() {
	let value;
	clearRecentSearchesDialog.subscribe((state) => (value = state))();
	return value;
}

describe('clearRecentSearchesDialogStore', () => {
	beforeEach(() => {
		closeClearRecentSearchesDialog();
	});

	it('opens with a confirmation callback and focus target', () => {
		const onConfirm = () => {};
		const returnFocusTo = document.createElement('button');

		openClearRecentSearchesDialog({ onConfirm, returnFocusTo });

		expect(getStoreValue()).toEqual({ open: true, onConfirm, returnFocusTo });
	});

	it('closes and returns the focus target', () => {
		const returnFocusTo = document.createElement('button');
		openClearRecentSearchesDialog({ onConfirm: () => {}, returnFocusTo });

		expect(closeClearRecentSearchesDialog()).toBe(returnFocusTo);
		expect(getStoreValue()).toEqual({ open: false, onConfirm: null, returnFocusTo: null });
	});
});
