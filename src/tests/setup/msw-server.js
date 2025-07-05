import { setupServer } from 'msw/node';
import { beforeAll, afterAll, afterEach } from 'vitest';
import { handlers } from '../mocks/handlers.js';

// This configures a Service Worker with the given request handlers.
export const server = setupServer(...handlers);

// Establish API mocking before all tests.
beforeAll(() => {
	server.listen({ onUnhandledRequest: 'warn' });
});

// Clean up after the tests are finished.
afterAll(() => {
	server.close();
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => {
	server.resetHandlers();
});
