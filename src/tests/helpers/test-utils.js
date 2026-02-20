import { render } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * Custom render function that sets up common testing utilities
 * @param {*} Component - Svelte component to render
 * @param {Object} options - Render options
 * @param {Object} options.props - Component props
 * @param {Object} options.context - Component context
 * @param {boolean} options.withUserEvent - Whether to set up user event utilities
 * @returns {Object} Extended render result with user event utilities
 */
export function renderWithUtils(Component, options = {}) {
	const { props = {}, context = {}, withUserEvent = true, ...renderOptions } = options;

	const result = render(Component, { props, context, ...renderOptions });

	const utils = {
		...result,
		user: withUserEvent ? userEvent.setup() : null
	};

	return utils;
}

/**
 * Create a mock store for testing Svelte stores
 * @param {*} initialValue - Initial store value
 * @returns {Object} Mock store with subscribe, set, and update methods
 */
export function createMockStore(initialValue) {
	let value = initialValue;
	const subscribers = new Set();

	return {
		subscribe: vi.fn((fn) => {
			subscribers.add(fn);
			fn(value);
			// Return the unsubscribe function directly, not wrapped in an object
			return () => {
				subscribers.delete(fn);
			};
		}),
		set: vi.fn((newValue) => {
			value = newValue;
			subscribers.forEach((fn) => fn(value));
		}),
		update: vi.fn((fn) => {
			value = fn(value);
			subscribers.forEach((fn) => fn(value));
		}),
		// For testing purposes
		_getValue: () => value,
		_getSubscribers: () => subscribers
	};
}

/**
 * Mock SvelteKit navigation functions
 */
export function mockSvelteKitNavigation() {
	return {
		goto: vi.fn(),
		invalidate: vi.fn(),
		invalidateAll: vi.fn(),
		preloadData: vi.fn(),
		preloadCode: vi.fn(),
		replaceState: vi.fn(),
		pushState: vi.fn()
	};
}

/**
 * Mock page store with common properties
 */
export function createMockPageStore(overrides = {}) {
	const defaultPage = {
		url: new URL('http://localhost:5173/'),
		params: {},
		route: { id: '/' },
		status: 200,
		error: null,
		data: {},
		form: null,
		state: {},
		...overrides
	};

	return createMockStore(defaultPage);
}

/**
 * Create a mock fetch function for testing API calls
 */
export function createMockFetch(responses = {}) {
	return vi.fn().mockImplementation((url, options = {}) => {
		const key = `${options.method || 'GET'} ${url}`;
		const response = responses[key] || responses[url];

		if (response) {
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve(response),
				text: () => Promise.resolve(JSON.stringify(response)),
				...response._meta
			});
		}

		// Default response if no mock is provided
		return Promise.resolve({
			ok: false,
			status: 404,
			json: () => Promise.resolve({ error: 'Not found' }),
			text: () => Promise.resolve('Not found')
		});
	});
}

/**
 * Wait for Svelte component to update after state changes
 */
export function waitForSvelteUpdate() {
	return new Promise((resolve) => {
		// Use setTimeout to wait for next tick
		setTimeout(resolve, 0);
	});
}

/**
 * Simulate viewport resize for responsive testing
 */
export function mockViewportSize(width, height) {
	Object.defineProperty(window, 'innerWidth', {
		writable: true,
		configurable: true,
		value: width
	});

	Object.defineProperty(window, 'innerHeight', {
		writable: true,
		configurable: true,
		value: height
	});

	// Trigger resize event
	window.dispatchEvent(new Event('resize'));
}

/**
 * Mock keyboard event helpers
 */
export const keyboardHelpers = {
	pressEscape: () => new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }),
	pressEnter: () => new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }),
	pressTab: () => new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9 }),
	pressArrowDown: () => new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40 }),
	pressArrowUp: () => new KeyboardEvent('keydown', { key: 'ArrowUp', keyCode: 38 })
};

/**
 * Accessibility testing helpers
 */
export const a11yHelpers = {
	/**
	 * Check if element has proper ARIA attributes
	 */
	checkARIAAttributes: (element, expectedAttributes) => {
		const violations = [];

		Object.entries(expectedAttributes).forEach(([attr, expectedValue]) => {
			const actualValue = element.getAttribute(attr);
			if (actualValue !== expectedValue) {
				violations.push(`Expected ${attr}="${expectedValue}", got "${actualValue}"`);
			}
		});

		return {
			isValid: violations.length === 0,
			violations
		};
	},

	/**
	 * Check if element is focusable
	 */
	isFocusable: (element) => {
		const focusableElements = [
			'button',
			'input',
			'select',
			'textarea',
			'a[href]',
			'[tabindex]:not([tabindex="-1"])'
		];

		return (
			focusableElements.some((selector) => element.matches(selector)) ||
			element.getAttribute('tabindex') === '0'
		);
	}
};

/**
 * Mock component props with default values
 */
export function createMockProps(component, overrides = {}) {
	// This is a basic implementation - in practice, you might want to
	// introspect the component to get its prop definitions
	const commonProps = {
		class: '',
		id: '',
		...overrides
	};

	return commonProps;
}
