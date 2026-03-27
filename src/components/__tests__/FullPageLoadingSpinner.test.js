import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import FullPageLoadingSpinner from '$components/FullPageLoadingSpinner.svelte';
import { locale } from 'svelte-i18n';

vi.mock('svelte-i18n', () => {
	let currentLocale = 'en';
	const tSubscribers = [];
	const translations = {
		en: {
			loading: 'Loading'
		},
		es: {
			loading: 'Cargando'
		}
	};

	const getTranslator = () => (key) => translations[currentLocale]?.[key] || key;

	return {
		t: {
			subscribe: vi.fn((fn) => {
				tSubscribers.push(fn);
				fn(getTranslator());

				return {
					unsubscribe: () => {
						const index = tSubscribers.indexOf(fn);
						if (index !== -1) tSubscribers.splice(index, 1);
					}
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

describe('FullPageLoadingSpinner', () => {
	beforeEach(() => {
		locale.set('en');
	});

	test('renders when visible', () => {
		const { container } = render(FullPageLoadingSpinner, { props: { visible: true } });

		expect(screen.getByText('Loading...')).toBeInTheDocument();
		expect(container.querySelector('.animate-spin')).toBeInTheDocument();
	});

	test('does not render when not visible', () => {
		const { container } = render(FullPageLoadingSpinner, { props: { visible: false } });

		expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
		expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
	});

	test('renders an accessible loading status in English by default', () => {
		render(FullPageLoadingSpinner);

		const status = screen.getByRole('status', { name: 'Loading' });
		expect(status).toHaveAttribute('aria-live', 'polite');
		expect(screen.getByText('Loading...')).toBeInTheDocument();
	});

	test('updates the visible text and aria-label when the locale changes to Spanish', async () => {
		render(FullPageLoadingSpinner);

		locale.set('es');

		await waitFor(() => {
			expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
		});
		expect(screen.getByText('Cargando...')).toBeInTheDocument();
	});
});
