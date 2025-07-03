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

// Mock environment variables
vi.mock('$env/static/public', () => ({
	PUBLIC_OBA_REGION_NAME: 'Test Region',
	PUBLIC_OBA_LOGO_URL: '/test-logo.png',
	PUBLIC_OBA_SERVER_URL: 'https://api.test.com',
	PUBLIC_OBA_MAP_PROVIDER: 'osm',
	PUBLIC_NAV_BAR_LINKS: '{"Home": "/", "About": "/about"}'
}));

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key); // Return a function that returns the key
			return { unsubscribe: () => {} };
		})
	},
	_: vi.fn((key) => key)
}));

// Mock analytics
vi.mock('$lib/Analytics/PlausibleAnalytics', () => ({
	default: {
		reportSearchQuery: vi.fn(),
		reportEvent: vi.fn()
	}
}));

// Mock geolocation
global.navigator = {
	...global.navigator,
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
