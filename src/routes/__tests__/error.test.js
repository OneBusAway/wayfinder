import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ErrorPage from '$src/routes/+error.svelte';
import { locale, __setTranslatorMode } from 'svelte-i18n';
import { page } from '$app/stores';

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
	let mode = 'normal';
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

	const getTranslator = () => {
		if (mode === 'non-function') return null;
		if (mode === 'throws')
			return () => {
				throw new Error('Translator error');
			};
		if (mode === 'returns-key') return (key) => key;
		return (key) => translations[currentLocale]?.[key] || key;
	};

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
		},
		__setTranslatorMode: (newMode) => {
			mode = newMode;
			const translator = getTranslator();
			tSubscribers.forEach((fn) => fn(translator));
		}
	};
});

describe('ErrorPage', () => {
	beforeEach(() => {
		locale.set('en');
		__setTranslatorMode('normal');
		page.__setStatus(404);
		page.__setError({ message: 'Not Found' });
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

	test('hides #error-detail when error message is absent', () => {
		page.__setError(null);
		const { container } = render(ErrorPage);

		expect(container.querySelector('#error-detail')).not.toBeInTheDocument();
	});

	test('sets document title to "status — title"', () => {
		render(ErrorPage);

		expect(document.title).toBe('404 — Page not found');
	});

	describe('safeTranslate fallbacks', () => {
		test('renders hardcoded fallbacks when $_ resolves to a non-function', () => {
			__setTranslatorMode('non-function');
			render(ErrorPage);

			expect(screen.getByText('Page not found')).toBeInTheDocument();
			expect(screen.getByText('Go home')).toBeInTheDocument();
			expect(screen.getByText('Go back')).toBeInTheDocument();
		});

		test('renders hardcoded fallbacks when $_ throws an error', () => {
			__setTranslatorMode('throws');
			render(ErrorPage);

			expect(screen.getByText('Page not found')).toBeInTheDocument();
			expect(screen.getByText('Go home')).toBeInTheDocument();
			expect(screen.getByText('Go back')).toBeInTheDocument();
		});

		test('renders hardcoded fallbacks when translator returns the key unchanged', () => {
			__setTranslatorMode('returns-key');
			render(ErrorPage);

			// Should fall back to 'Page not found', not the raw key 'error.404.title'
			expect(screen.getByText('Page not found')).toBeInTheDocument();
			expect(screen.queryByText('error.404.title')).not.toBeInTheDocument();
		});
	});

	describe('Go back button behavior', () => {
		test('calls history.back() when there is browser history (length > 1)', async () => {
			const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
			const lengthSpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(5);

			render(ErrorPage);
			await fireEvent.click(screen.getByRole('button', { name: /Go back/i }));

			expect(backSpy).toHaveBeenCalledOnce();

			backSpy.mockRestore();
			lengthSpy.mockRestore();
		});

		test('navigates to / when there is no browser history (length <= 1)', async () => {
			const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
			const lengthSpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);

			// Stub window.location to capture the href assignment without triggering
			const originalLocation = window.location;
			let hrefValue = originalLocation.href;
			Object.defineProperty(window, 'location', {
				configurable: true,
				value: {
					get href() {
						return hrefValue;
					},
					set href(v) {
						hrefValue = v;
					}
				}
			});

			render(ErrorPage);
			await fireEvent.click(screen.getByRole('button', { name: /Go back/i }));

			expect(backSpy).not.toHaveBeenCalled();
			expect(hrefValue).toBe('/');

			Object.defineProperty(window, 'location', {
				configurable: true,
				value: originalLocation
			});
			backSpy.mockRestore();
			lengthSpy.mockRestore();
		});
	});

	describe('status code branches', () => {
		test.each([
			[403, 'Access denied'],
			[500, 'Server error'],
			[418, 'Something went wrong'] // generic fallthrough
		])('renders the %i branch', (status, title) => {
			page.__setStatus(status);
			page.__setError(null);
			const { container } = render(ErrorPage);

			expect(screen.getByText(String(status))).toBeInTheDocument();
			expect(screen.getByText(title)).toBeInTheDocument();
			// detail block should not be present when error is null
			expect(container.querySelector('#error-detail')).not.toBeInTheDocument();
		});
	});
});
