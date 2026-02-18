import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
}));

// Mock dynamic environment variables (fallback for tests that don't provide their own mock).
// Test files that need to mutate env values should declare their own vi.mock with a getter pattern.
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_ANALYTICS_DOMAIN: '',
		PUBLIC_ANALYTICS_ENABLED: 'false',
		PUBLIC_ANALYTICS_API_HOST: ''
	}
}));

// Mock environment variables
vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_REGION_NAME: 'Test Region',
	PUBLIC_OBA_LOGO_URL: '/test-logo.png',
	PUBLIC_OBA_SERVER_URL: 'https://api.test.com',
	PUBLIC_OBA_MAP_PROVIDER: 'osm',
	PUBLIC_NAV_BAR_LINKS: '{"Home": "/", "About": "/about"}',
	PUBLIC_DISTANCE_UNIT: '' // Empty = auto-detect from browser
}));

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key); // Return a function that returns the key
			return () => {};
		})
	},
	_: vi.fn((key) => key),
	addMessages: vi.fn(),
	init: vi.fn(),
	getLocaleFromNavigator: vi.fn(() => 'en'),
	locale: {
		subscribe: vi.fn((fn) => {
			fn('en');
			return () => {}; 
		})
	}
}));

// Mock i18n.js file
vi.mock('$lib/i18n', () => ({}));

// Mock SvelteKit app stores
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn((fn) => {
			fn({
				url: new URL('https://example.com/stops/1_75403'),
				params: { stopID: '1_75403' },
				route: { id: '/stops/[stopID]' },
				data: {}
			});
			return vi.fn();
		})
	},
	navigating: {
		subscribe: vi.fn((fn) => {
			fn(null);
			return vi.fn();
		})
	},
	updated: {
		subscribe: vi.fn((fn) => {
			fn(false);
			return vi.fn(); 
		})
	}
}));

// Mock geolocation and navigator.language
global.navigator = {
	...global.navigator,
	language: 'en-US', // Default to en-US for tests (imperial units)
	geolocation: {
		getCurrentPosition: vi.fn(),
		watchPosition: vi.fn(),
		clearWatch: vi.fn()
	}
};

// Mock console methods to reduce noise in tests
global.console = {
	...global.console,
	warn: vi.fn(),
	error: vi.fn()
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
});

// Mock scrollTo
global.scrollTo = vi.fn();

// Mock SvelteKit environment
vi.mock('$app/environment', () => ({
	browser: false,
	dev: false,
	building: false,
	version: '1.0.0'
}));

// Mock localStorage
global.localStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

// keybinding action is no longer mocked - let it run normally for testing

// Mock build-time defined globals
globalThis.__OBA_LOGO_URL_DARK__ = '';
