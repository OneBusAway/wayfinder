import { writable } from 'svelte/store';

export const userLocation = writable(
	/** @type {{ lat: number | null, lng: number | null }} */ ({ lat: null, lng: null })
);
