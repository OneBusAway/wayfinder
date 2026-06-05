import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import LoadingSpinner from '../LoadingSpinner.svelte';
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

describe('LoadingSpinner', () => {
	beforeEach(() => {
		locale.set('en');
	});

	test('renders an accessible loading status in English by default', () => {
		render(LoadingSpinner);

		const status = screen.getByRole('status', { name: 'Loading' });
		expect(status).toHaveAttribute('aria-live', 'polite');
		expect(screen.getByText('Loading...')).toBeInTheDocument();
	});

	test('updates the visible text and aria-label when the locale changes to Spanish', async () => {
		render(LoadingSpinner);

		locale.set('es');

		await waitFor(() => {
			expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
		});
		expect(screen.getByText('Cargando...')).toBeInTheDocument();
	});

	test('has correct CSS classes for styling', () => {
		const { container } = render(LoadingSpinner);

		const outerDiv = container.firstChild;
		expect(outerDiv).toHaveClass(
			'absolute',
			'inset-0',
			'z-50',
			'flex',
			'items-center',
			'justify-center'
		);
		expect(outerDiv).toHaveClass('bg-neutral-800', 'bg-opacity-80', 'md:rounded-lg');
	});

	test('spinner SVG has correct attributes', () => {
		const { container } = render(LoadingSpinner);

		const svg = container.querySelector('svg');
		expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg');
		expect(svg).toHaveAttribute('fill', 'none');
		expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
	});
});
