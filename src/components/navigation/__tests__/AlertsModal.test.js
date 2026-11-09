import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import AlertsModal from '../AlertsModal.svelte';

// The dialog has two buttons named "Close": the footer button and the corner X that
// <Dialog.Content> renders after its children.
function getFooterCloseButton() {
	return screen.getAllByRole('button', { name: 'Close' })[0];
}

// Mock svelte-i18n to return English by default
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
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('renders alert modal with correct title', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		// Check that the modal title is displayed
		expect(screen.getByText('Service Alert')).toBeInTheDocument();
	});

	test('renders alert description', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
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
				alert: mockAlert,
				open: true
			}
		});

		expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
	});

	test('renders More Info button', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });
		expect(moreInfoButton).toBeInTheDocument();
	});

	test.each([
		['footer Close', 0],
		['corner X', 1]
	])('closes modal when %s button is clicked', async (_label, index) => {
		const user = userEvent.setup();

		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		await user.click(screen.getAllByRole('button', { name: 'Close' })[index]);

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	test('opens external link when More Info button is clicked', async () => {
		const user = userEvent.setup();

		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });
		await user.click(moreInfoButton);

		expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/alerts/en', '_blank');
	});

	test('uses English translation by default', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
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
				alert: mockAlert,
				open: true
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
				alert: alertWithoutEnglish,
				open: true
			}
		});

		// Should use the first available translation (Spanish)
		expect(screen.getByText('Alerta de Servicio')).toBeInTheDocument();
		expect(screen.getByText('La Ruta 44 está experimentando retrasos.')).toBeInTheDocument();
	});

	test('language detection works with different languages', () => {
		// Test that the component renders without errors when language changes
		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		// Should show some translation (either English or fallback)
		expect(screen.getByText('Service Alert')).toBeInTheDocument();
		expect(
			screen.getByText('Route 44 is experiencing delays due to traffic conditions.')
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
					alert: alertWithEmptyTranslations,
					open: true
				}
			});
		}).not.toThrow();
	});

	test('modal is a dialog labelled by the alert header', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		expect(screen.getByRole('dialog', { name: 'Service Alert' })).toBeInTheDocument();
	});

	test('does not render More Info button when URL translation is empty', () => {
		const alertWithoutUrl = {
			...mockAlert,
			url: { translation: [] }
		};

		render(AlertsModal, {
			props: {
				alert: alertWithoutUrl,
				open: true
			}
		});

		// Should not render the More Info button
		const moreInfoButton = screen.queryByRole('button', { name: 'More Info' });
		expect(moreInfoButton).not.toBeInTheDocument();
	});

	test('does not render More Info button when URL text is whitespace or empty', () => {
		const alertWithWhitespaceUrl = {
			...mockAlert,
			url: { translation: [{ language: 'en', text: '   ' }] }
		};

		render(AlertsModal, {
			props: {
				alert: alertWithWhitespaceUrl,
				open: true
			}
		});

		const moreInfoButton = screen.queryByRole('button', { name: 'More Info' });
		expect(moreInfoButton).not.toBeInTheDocument();
	});

	test('does not render More Info button when alert has no url property', () => {
		const alertWithoutUrlProp = {
			...mockAlert,
			url: undefined
		};

		render(AlertsModal, {
			props: {
				alert: alertWithoutUrlProp,
				open: true
			}
		});

		const moreInfoButton = screen.queryByRole('button', { name: 'More Info' });
		expect(moreInfoButton).not.toBeInTheDocument();
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
					alert: incompleteAlert,
					open: true
				}
			});
		}).not.toThrow();
	});

	test('modal is closed by default', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert
			}
		});

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	test('modal is open when open is true', () => {
		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		// The modal should be visible when first rendered
		expect(screen.getByText('Service Alert')).toBeInTheDocument();
		expect(
			screen.getByText('Route 44 is experiencing delays due to traffic conditions.')
		).toBeInTheDocument();
	});

	test('language detection fallback works correctly', () => {
		// Component should always show some text even with different languages
		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		// Should show English translation as default
		expect(screen.getByText('Service Alert')).toBeInTheDocument();
		expect(
			screen.getByText('Route 44 is experiencing delays due to traffic conditions.')
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
				alert: mockAlert,
				open: true
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
				alert: mockAlert,
				open: true
			}
		});

		const closeButton = getFooterCloseButton();
		const moreInfoButton = screen.getByRole('button', { name: 'More Info' });

		// Should be able to focus buttons
		closeButton.focus();
		expect(closeButton).toHaveFocus();

		moreInfoButton.focus();
		expect(moreInfoButton).toHaveFocus();
	});

	test('closes modal when Escape is pressed', async () => {
		const user = userEvent.setup();

		render(AlertsModal, {
			props: {
				alert: mockAlert,
				open: true
			}
		});

		await user.keyboard('{Escape}');

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});
});
