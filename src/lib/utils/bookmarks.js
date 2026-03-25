import {
    STORAGE_KEY_BOOKMARKS
} from '$env/static/public';

function getBookmarkStore() {
  try {
    const data = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.log(e);
    return;
  }
}
function saveBookmarkStore(store) {
  localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(store));
}

export function saveBookmarktoLocalStorage(route) {
    const tripId = route.tripId;
    const bookmarks = getBookmarkStore();
    bookmarks[tripId] = route;
    saveBookmarkStore(bookmarks);
}

export function deleteBookmarkFromLocalStorage(tripId) {
    const bookmarks = getBookmarkStore();
    delete bookmarks[tripId];
    saveBookmarkStore(bookmarks);
}