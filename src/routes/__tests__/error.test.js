import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ErrorPage from '$src/routes/+error.svelte';
import { locale } from 'svelte-i18n';

// Override the default page store mock to include error state
vi.mock('$app/stores', () => {
	let currentStatus = 404;
	let currentError = { message: 'Not Found' };

	return {
		page: {
			subscribe: vi.fn((fn) => {
				fn({
					url: new URL('https://example.com/unknown-page'),
					params: {},
					route: { id: null },
					data: {},
					status: currentStatus,
					error: currentError
				});
				return vi.fn();
			}),
			// Helper for tests to update the mock values
			__setStatus: (status) => {
				currentStatus = status;
			},
			__setError: (error) => {
				currentError = error;
			}
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
	};
});

vi.mock('svelte-i18n', () => {
	let currentLocale = 'en';
	const tSubscribers = [];
	const translations = {
		en: {
			'error.404.title': 'Page not found',
			'error.404.description': "The page you're looking for doesn't exist or has been moved.",
			'error.403.title': 'Access denied',
			'error.403.description': "You don't have permission to view this page.",
			'error.500.title': 'Server error',
			'error.500.description': 'Something went wrong on our end. Please try again later.',
			'error.generic.title': 'Something went wrong',
			'error.generic.description': 'An unexpected error occurred.',
			'error.go_home': 'Go home',
			'error.go_back': 'Go back'
		},
		es: {
			'error.404.title': 'Página no encontrada',
			'error.404.description': 'La página que buscas no existe o ha sido movida.',
			'error.go_home': 'Ir al inicio',
			'error.go_back': 'Volver'
		}
	};

	const getTranslator = () => (key) => translations[currentLocale]?.[key] || key;

	return {
		_: {
			subscribe: vi.fn((fn) => {
				tSubscribers.push(fn);
				fn(getTranslator());
				return () => {
					const index = tSubscribers.indexOf(fn);
					if (index !== -1) tSubscribers.splice(index, 1);
				};
			})
		},
		t: {
			subscribe: vi.fn((fn) => {
				tSubscribers.push(fn);
				fn(getTranslator());
				return () => {
					const index = tSubscribers.indexOf(fn);
					if (index !== -1) tSubscribers.splice(index, 1);
				};
			})
		},
		locale: {
			subscribe: vi.fn((fn) => {
				fn(currentLocale);
				return { unsubscribe: () => {} };
			}),
			set: vi.fn((newLocale) => {
				currentLocale = newLocale;
				const translator = getTranslator();
				tSubscribers.forEach((fn) => fn(translator));
			})
		}
	};
});

describe('ErrorPage', () => {
	beforeEach(() => {
		locale.set('en');
	});

	test('renders the 404 status code', () => {
		render(ErrorPage);

		const statusCode = screen.getByText('404');
		expect(statusCode).toBeInTheDocument();
	});

	test('renders the error title via i18n', () => {
		render(ErrorPage);

		expect(screen.getByText('Page not found')).toBeInTheDocument();
	});

	test('renders the error description via i18n', () => {
		render(ErrorPage);

		expect(
			screen.getByText("The page you're looking for doesn't exist or has been moved.")
		).toBeInTheDocument();
	});

	test('renders a "Go home" link pointing to /', () => {
		render(ErrorPage);

		const goHomeLink = screen.getByRole('link', { name: /Go home/i });
		expect(goHomeLink).toBeInTheDocument();
		expect(goHomeLink).toHaveAttribute('href', '/');
	});

	test('renders a "Go back" button', () => {
		render(ErrorPage);

		const goBackButton = screen.getByRole('button', { name: /Go back/i });
		expect(goBackButton).toBeInTheDocument();
	});

	test('has unique IDs on key elements for browser testing', () => {
		const { container } = render(ErrorPage);

		expect(container.querySelector('#error-page')).toBeInTheDocument();
		expect(container.querySelector('#error-status-code')).toBeInTheDocument();
		expect(container.querySelector('#error-title')).toBeInTheDocument();
		expect(container.querySelector('#error-description')).toBeInTheDocument();
		expect(container.querySelector('#error-go-home')).toBeInTheDocument();
		expect(container.querySelector('#error-go-back')).toBeInTheDocument();
	});

	test('updates text when locale changes to Spanish', async () => {
		render(ErrorPage);

		locale.set('es');

		await waitFor(() => {
			expect(screen.getByText('Página no encontrada')).toBeInTheDocument();
		});
		expect(screen.getByText('Ir al inicio')).toBeInTheDocument();
	});
});
