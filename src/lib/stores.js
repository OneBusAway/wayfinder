import { writable } from 'svelte/store';

export const routesStore = writable([]);
export const dataFetched = writable(false);
