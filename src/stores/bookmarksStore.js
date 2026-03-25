import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = "bookmarks"

function createBookmarkStore() {
    let initial = {}
    // load initial data from localStorage
    if (browser) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            initial = stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.warn('Failed to load recent trips from localStorage:', e);
        }
    }
    const { subscribe, set, update } = writable(initial);

    return {
        subscribe,

        // add/update item
        save: (bookmark) =>
            update((store) => {
                const id = bookmark.routeName               
                const description = bookmark.description
                if (!id) {
                    return store;
                }
                const newStore = { ...store, [id]: { description, name: id } };
                if (browser) {
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(newStore));
                    }
                    catch (e) {
                        console.warn('Failed to save bookmark to localStorage:', e);
                    }
                }
                return newStore;
            }),
        getOne: (id) => {
            const data = localStorage.getItem(STORAGE_KEY);
            const store = data ? JSON.parse(data) : {};
            return store[id] || null;
        },
        remove: (id) =>
            update((store) => {
                const newStore = { ...store };
                delete newStore[id];
                if (browser) {
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(newStore));
                    }
                    catch (e) {
                        console.warn('Failed to remove bookmark from localStorage:', e);
                    }
                }
                return newStore;
            }),
        clear: () => {
            if (browser) {
                try {
                    localStorage.removeItem(STORAGE_KEY);
                }
                catch (e) {
                    console.warn('Failed to clear bookmarks from localStorage:', e);
                }
            }
            set({});
        }
    };
}

export const bookmarks = createBookmarkStore();