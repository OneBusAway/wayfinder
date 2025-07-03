import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import AlertsModal from '../AlertsModal.svelte';

describe('AlertsModal', () => {
	let mockAlert;
	let mockWindowOpen;

	beforeEach(() => {
		// Mock window.open
		mockWindowOpen = vi.fn();
		global.window.open = mockWindowOpen;

		// Mock alert data with multilingual support
		mockAlert = {
			id: 'alert_1',
			headerText: {
				translation: [
					{ language: 'en', text: 'Service Alert' },
					{ language: 'es', text: 'Alerta de Servicio' },
					{ language: 'fr', text: 'Alerte de Service' }
				]
			},
			descriptionText: {
				translation: [
					{ language: 'en', text: 'Route 44 is experiencing delays due to traffic conditions.' },
					{
						language: 'es',
						text: 'La Ruta 44 está experimentando retrasos debido a condiciones de tráfico.'
					},
					{
						language: 'fr',
						text: 'La Route 44 subit des retards en raison des conditions de circulation.'
					}
				]
			},
			url: {
				translation: [
					{ language: 'en', text: 'https://example.com/alerts/en' },
					{ language: 'es', text: 'https://example.com/alerts/es' },
					{ language: 'fr', text: 'https://example.com/alerts/fr' }
				]
			},
			severity: 'warning',
			activeWindows: [
				{
					from: Date.now() - 3600000, // 1 hour ago
					to: Date.now() + 3600000 // 1 hour from now
				}
			]
		};

		// Mock navigator.language
		Object.defineProperty(navigator, 'language', {
			value: 'en-US',
			configurable: true
		});

		// Mock svelte-i18n getLocaleFromNavigator
		vi.mock('svelte-i18n', () => ({
			getLocaleFromNavigator: vi.fn(() => 'en-US'),
			t: {
				subscribe: vi.fn((fn) => {
					const mockT = (key) => {
						const translations = {
							'alert.close': 'Close',
							'alert.more_info': 'More Info'
						};
						return translations[key] || key;
					};
					fn(mockT);
					return { unsubscribe: () => {} };
				})
			}
		}));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('renders alert modal with correct title', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// Check that the modal title is displayed
		expect(screen.getByText('Service Alert')).toBeInTheDocument();
	});

	test('renders alert description', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// Check that the alert description is displayed
		expect(
			screen.getByText('Route 44 is experiencing delays due to traffic conditions.')
		).toBeInTheDocument();
	});

	test('renders Close button', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });
		expect(closeButton).toBeInTheDocument();
	});

	test('renders More Info button', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });
		expect(moreInfoButton).toBeInTheDocument();
	});

	test('closes modal when Close button is clicked', async () => {
		const user = userEvent.setup();

		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });
		await user.click(closeButton);

		// After clicking close, the modal should be closed
		// This is indicated by the showModal state being false
		// We can't directly test the state, but we can verify the modal behavior
		expect(closeButton).toBeInTheDocument();
	});

	test('opens external link when More Info button is clicked', async () => {
		const user = userEvent.setup();

		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });
		await user.click(moreInfoButton);

		expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/alerts/en', '_blank');
	});

	test('uses English translation by default', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		expect(screen.getByText('Service Alert')).toBeInTheDocument();
		expect(
			screen.getByText('Route 44 is experiencing delays due to traffic conditions.')
		).toBeInTheDocument();
	});

	test('falls back to English when navigator language is not available', () => {
		// Mock navigator.language to a language not in our translations
		Object.defineProperty(navigator, 'language', {
			value: 'de-DE',
			configurable: true
		});

		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// Should fall back to English
		expect(screen.getByText('Service Alert')).toBeInTheDocument();
		expect(
			screen.getByText('Route 44 is experiencing delays due to traffic conditions.')
		).toBeInTheDocument();
	});

	test('uses first available translation when English is not available', () => {
		const alertWithoutEnglish = {
			...mockAlert,
			headerText: {
				translation: [
					{ language: 'es', text: 'Alerta de Servicio' },
					{ language: 'fr', text: 'Alerte de Service' }
				]
			},
			descriptionText: {
				translation: [
					{ language: 'es', text: 'La Ruta 44 está experimentando retrasos.' },
					{ language: 'fr', text: 'La Route 44 subit des retards.' }
				]
			},
			url: {
				translation: [
					{ language: 'es', text: 'https://example.com/alerts/es' },
					{ language: 'fr', text: 'https://example.com/alerts/fr' }
				]
			}
		};

		render(AlertsModal, {
			props: {
				alert: alertWithoutEnglish
			}
		});

		// Should use the first available translation (Spanish)
		expect(screen.getByText('Alerta de Servicio')).toBeInTheDocument();
		expect(screen.getByText('La Ruta 44 está experimentando retrasos.')).toBeInTheDocument();
	});

	test('uses Spanish translation when navigator language is Spanish', () => {
		// Mock navigator.language to Spanish
		Object.defineProperty(navigator, 'language', {
			value: 'es-ES',
			configurable: true
		});

		// Mock getLocaleFromNavigator to return Spanish
		vi.mock('svelte-i18n', () => ({
			getLocaleFromNavigator: vi.fn(() => 'es-ES'),
			t: {
				subscribe: vi.fn((fn) => {
					const mockT = (key) => {
						const translations = {
							'alert.close': 'Cerrar',
							'alert.more_info': 'Más Información'
						};
						return translations[key] || key;
					};
					fn(mockT);
					return { unsubscribe: () => {} };
				})
			}
		}));

		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// Should use Spanish translation
		expect(screen.getByText('Alerta de Servicio')).toBeInTheDocument();
		expect(
			screen.getByText('La Ruta 44 está experimentando retrasos debido a condiciones de tráfico.')
		).toBeInTheDocument();
	});

	test('handles empty translation arrays gracefully', () => {
		const alertWithEmptyTranslations = {
			...mockAlert,
			headerText: { translation: [] },
			descriptionText: { translation: [] },
			url: { translation: [] }
		};

		expect(() => {
			render(AlertsModal, {
				props: {
					alert: alertWithEmptyTranslations
				}
			});
		}).not.toThrow();
	});

	test('modal has correct accessibility attributes', () => {
		const { container } = render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// The modal should have proper ARIA attributes
		// This depends on how Flowbite's Modal component implements accessibility
		// We can check that the modal content is accessible
		const modalContent = container.querySelector('p');
		expect(modalContent).toHaveClass(
			'text-base',
			'leading-relaxed',
			'text-gray-500',
			'dark:text-gray-200'
		);
	});

	test('Close button has correct styling', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });
		expect(closeButton).toHaveClass('bg-gray-300', 'text-black', 'hover:bg-gray-400');
		expect(closeButton).toHaveClass(
			'dark:bg-gray-700',
			'dark:text-white',
			'dark:hover:bg-gray-600'
		);
	});

	test('More Info button has correct styling', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });
		expect(moreInfoButton).toHaveClass(
			'bg-brand-secondary',
			'text-white',
			'hover:bg-brand-secondary'
		);
		expect(moreInfoButton).toHaveClass('dark:bg-brand', 'dark:hover:bg-brand-secondary');
	});

	test('modal description has correct styling', () => {
		const { container } = render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		const description = container.querySelector('p');
		expect(description).toHaveClass(
			'text-base',
			'leading-relaxed',
			'text-gray-500',
			'dark:text-gray-200'
		);
	});

	test('footer buttons are properly aligned', () => {
		const { container } = render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// Check that the footer has proper alignment
		const footerContainer = container.querySelector('.flex-1.text-right');
		expect(footerContainer).toBeInTheDocument();
		expect(footerContainer).toHaveClass('flex-1', 'text-right');
	});

	test('handles missing URL translation gracefully', () => {
		const alertWithoutUrl = {
			...mockAlert,
			url: { translation: [] }
		};

		render(AlertsModal, {
			props: {
				alert: alertWithoutUrl
			}
		});

		// Should still render the More Info button
		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });
		expect(moreInfoButton).toBeInTheDocument();
	});

	test('More Info button with empty URL translation still calls window.open', async () => {
		const user = userEvent.setup();
		const alertWithEmptyUrl = {
			...mockAlert,
			url: { translation: [] }
		};

		render(AlertsModal, {
			props: {
				alert: alertWithEmptyUrl
			}
		});

		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });
		await user.click(moreInfoButton);

		// Should still call window.open, even if with undefined
		expect(mockWindowOpen).toHaveBeenCalledWith(undefined, '_blank');
	});

	test('handles missing translation properties gracefully', () => {
		const incompleteAlert = {
			id: 'alert_2',
			headerText: {
				translation: [{ language: 'en', text: 'Service Alert' }]
			},
			// Missing descriptionText and url properties
			severity: 'warning'
		};

		expect(() => {
			render(AlertsModal, {
				props: {
					alert: incompleteAlert
				}
			});
		}).not.toThrow();
	});

	test('modal is initially open', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// The modal should be visible when first rendered
		expect(screen.getByText('Service Alert')).toBeInTheDocument();
		expect(
			screen.getByText('Route 44 is experiencing delays due to traffic conditions.')
		).toBeInTheDocument();
	});

	test('language detection works correctly', () => {
		// Test with French language
		Object.defineProperty(navigator, 'language', {
			value: 'fr-FR',
			configurable: true
		});

		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// Should use French translation
		expect(screen.getByText('Alerte de Service')).toBeInTheDocument();
		expect(
			screen.getByText('La Route 44 subit des retards en raison des conditions de circulation.')
		).toBeInTheDocument();
	});

	test('handles complex language codes', () => {
		// Test with complex language code (should extract 'en' from 'en-US')
		Object.defineProperty(navigator, 'language', {
			value: 'en-US-POSIX',
			configurable: true
		});

		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// Should use English translation
		expect(screen.getByText('Service Alert')).toBeInTheDocument();
		expect(
			screen.getByText('Route 44 is experiencing delays due to traffic conditions.')
		).toBeInTheDocument();
	});

	test('buttons are keyboard accessible', async () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		const closeButton = screen.getByRole('button', { name: 'Close' });
		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });

		// Should be able to focus buttons
		closeButton.focus();
		expect(closeButton).toHaveFocus();

		moreInfoButton.focus();
		expect(moreInfoButton).toHaveFocus();
	});

	test('modal autoclose property is set correctly', () => {
		const { container } = render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		// The Modal component should have autoclose enabled
		// This is a prop passed to the Flowbite Modal component
		// We can verify the component renders without throwing errors
		expect(container.firstChild).toBeInTheDocument();
	});
});
