import { browser } from '$app/environment';

/**
 * Initializes the system theme listener.
 * Detects the user's system preference for dark/light mode and applies it.
 * Listens for real-time changes to system preferences.
 */
export function initSystemTheme() {
	if (!browser) return;

	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

	function applyTheme(isDark) {
		document.documentElement.classList.toggle('dark', isDark);
		// Dispatch event for map providers
		window.dispatchEvent(new CustomEvent('themeChange', { detail: { darkMode: isDark } }));
	}

	// Apply initial theme
	applyTheme(mediaQuery.matches);

	// Listen for system preference changes
	mediaQuery.addEventListener('change', (e) => applyTheme(e.matches));

	// Clean up old localStorage preference
	localStorage.removeItem('theme');
}
