import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import LanguageSwitcher from '../LanguageSwitcher.svelte';

// Mock languages array - must be defined inline in mock factory
vi.mock('$lib/i18n', () => ({
	languages: [
		{ code: 'en', nativeName: 'English', englishName: 'English' },
		{ code: 'es', nativeName: 'Español', englishName: 'Spanish' },
		{ code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
		{ code: 'pl', nativeName: 'Polski', englishName: 'Polish' }
	]
}));

// Mock svelte-i18n locale store - use a factory function that returns a new object each time
let currentLocale = 'en';
const localeSubscribers = [];

vi.mock('svelte-i18n', () => {
	// Create the mock locale object inside the factory
	const mockLocale = {
		subscribe: vi.fn((fn) => {
			fn(currentLocale);
			localeSubscribers.push(fn);
			return { unsubscribe: () => {} };
		}),
		set: vi.fn((newLocale) => {
			currentLocale = newLocale;
			localeSubscribers.forEach((fn) => fn(newLocale));
		})
	};
	return {
		locale: mockLocale
	};
});

// Get reference to mock locale for test access
let mockLocale;

// Mock environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock environment variable - default to enabled
let mockEnvValue = { PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true' };

vi.mock('$env/dynamic/public', () => ({
	get env() {
		return mockEnvValue;
	}
}));

describe('LanguageSwitcher', () => {
	beforeEach(async () => {
		// Get reference to the mocked locale
		const svelteI18n = await import('svelte-i18n');
		mockLocale = svelteI18n.locale;

		currentLocale = 'en';
		localeSubscribers.length = 0;
		mockEnvValue = {
			PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
			PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: undefined,
			PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: undefined
		};
		vi.clearAllMocks();
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Rendering', () => {
		test('does not render when PUBLIC_LANGUAGE_SWITCHER_ENABLED is false', () => {
			mockEnvValue = { PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'false' };
			const { container } = render(LanguageSwitcher);
			const button = container.querySelector('button');
			expect(button).toBeNull();
		});
	});

	describe('Dropdown Menu', () => {
		test('opens dropdown when button is clicked', async () => {
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			// Find the dropdown menu
			const dropdown = container.querySelector('[class*="absolute"]');
			expect(dropdown).toBeInTheDocument();

			// Default menu format is "native-english"
			// English has same native/english name, so shows just "English"
			expect(dropdown.textContent).toContain('English');
			// Español has different names, so shows "Español (Spanish)"
			expect(dropdown.textContent).toContain('Español (Spanish)');
		});

		test('closes dropdown when clicking outside', async () => {
			const user = userEvent.setup();
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			expect(screen.getByText('Español (Spanish)')).toBeInTheDocument();

			// Click outside
			await user.click(document.body);

			await waitFor(() => {
				expect(screen.queryByText('Español (Spanish)')).not.toBeInTheDocument();
			});
		});

		test('highlights current language in dropdown', async () => {
			currentLocale = 'es';
			const user = userEvent.setup();
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			// Spanish has different native/english names, so shows "Español (Spanish)"
			const currentLanguageButton = screen.getByText('Español (Spanish)');
			expect(currentLanguageButton).toHaveClass('bg-gray-100', 'dark:bg-gray-700');
		});

		test('uses menu format from environment variable', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'english'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			// Find the dropdown menu
			const dropdown = container.querySelector('[class*="absolute"]');
			expect(dropdown).toBeInTheDocument();

			// Check that dropdown shows English names (not native-english format)
			expect(dropdown.textContent).toContain('English');
			expect(dropdown.textContent).toContain('Spanish');
			// Should not have the default native-english format (English shows as just "English" when names match)
			expect(dropdown.textContent).not.toContain('English (English)');
		});

		test('uses button format from environment variable', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: 'code'
			};
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			// Button should show "EN" when format is "code"
			const buttonText = button.textContent;
			expect(buttonText).toContain('EN');
		});
	});

	describe('Button Format Options', () => {
		test('displays native name when button format is "native"', () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: 'native'
			};
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			expect(button.textContent).toContain('English');
		});

		test('displays english name when button format is "english"', () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: 'english'
			};
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			expect(button.textContent).toContain('English');
		});

		test('displays native-english format when button format is "native-english"', () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: 'native-english'
			};
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			// English has same native/english name, so shows just "English"
			expect(button.textContent).toContain('English');
			expect(button.textContent).not.toContain('English (English)');
		});

		test('displays english-native format when button format is "english-native"', () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: 'english-native'
			};
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			// English has same native/english name, so shows just "English"
			expect(button.textContent).toContain('English');
			expect(button.textContent).not.toContain('English (English)');
		});

		test('displays code when button format is "code"', () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: 'code'
			};
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			expect(button.textContent).toContain('EN');
		});

		test('defaults to native format when button format is not set', () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true'
			};
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			expect(button.textContent).toContain('English');
			expect(button.textContent).not.toContain('(English)');
		});

		test('falls back to native-english format when button format is invalid', () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: 'invalid-format'
			};
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			// Should fallback to native-english format, but English has same names so shows just "English"
			expect(button.textContent).toContain('English');
			expect(button.textContent).not.toContain('English (English)');
		});
	});

	describe('Menu Format Options', () => {
		test('displays native name when menu format is "native"', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'native'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const dropdown = container.querySelector('[class*="absolute"]');
			expect(dropdown.textContent).toContain('English');
			expect(dropdown.textContent).toContain('Español');
			expect(dropdown.textContent).not.toContain('(English)');
		});

		test('displays english name when menu format is "english"', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'english'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const dropdown = container.querySelector('[class*="absolute"]');
			expect(dropdown.textContent).toContain('English');
			expect(dropdown.textContent).toContain('Spanish');
			expect(dropdown.textContent).not.toContain('Español');
		});

		test('displays native-english format when menu format is "native-english"', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'native-english'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const dropdown = container.querySelector('[class*="absolute"]');
			// English has same native/english name, so shows just "English"
			expect(dropdown.textContent).toContain('English');
			// Español has different names, so shows "Español (Spanish)"
			expect(dropdown.textContent).toContain('Español (Spanish)');
		});

		test('displays english-native format when menu format is "english-native"', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'english-native'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const dropdown = container.querySelector('[class*="absolute"]');
			// English has same native/english name, so shows just "English"
			expect(dropdown.textContent).toContain('English');
			expect(dropdown.textContent).not.toContain('English (English)');
			// Spanish has different names, so shows "Spanish (Español)"
			expect(dropdown.textContent).toContain('Spanish (Español)');
		});

		test('displays code when menu format is "code"', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'code'
			};
			const user = userEvent.setup();
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			expect(screen.getByText('EN')).toBeInTheDocument();
			expect(screen.getByText('ES')).toBeInTheDocument();
		});

		test('defaults to native-english format when menu format is not set', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const dropdown = container.querySelector('[class*="absolute"]');
			// English has same native/english name, so shows just "English"
			expect(dropdown.textContent).toContain('English');
			// Español has different names, so shows "Español (Spanish)"
			expect(dropdown.textContent).toContain('Español (Spanish)');
		});

		test('falls back to native-english format when menu format is invalid', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'invalid-format'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const dropdown = container.querySelector('[class*="absolute"]');
			// Should fallback to native-english format, but English has same names so shows just "English"
			expect(dropdown.textContent).toContain('English');
			// Español has different names, so shows "Español (Spanish)"
			expect(dropdown.textContent).toContain('Español (Spanish)');
		});
	});

	describe('Format Combinations', () => {
		test('button and menu can have different formats simultaneously', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT: 'code',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'native'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			// Button should show code
			const button = screen.getByRole('button', { name: /select language/i });
			expect(button.textContent).toContain('EN');

			// Menu should show native names
			await user.click(button);
			const dropdown = container.querySelector('[class*="absolute"]');
			expect(dropdown.textContent).toContain('English');
			expect(dropdown.textContent).toContain('Español');
			expect(dropdown.textContent).not.toContain('EN');
		});

		test('shows combined format for languages with different native and english names', async () => {
			mockEnvValue = {
				PUBLIC_LANGUAGE_SWITCHER_ENABLED: 'true',
				PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT: 'native-english'
			};
			const user = userEvent.setup();
			const { container } = render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const dropdown = container.querySelector('[class*="absolute"]');
			// Spanish has different names, so should show "Español (Spanish)"
			expect(dropdown.textContent).toContain('Español (Spanish)');
			// Arabic has different names, so should show "العربية (Arabic)"
			expect(dropdown.textContent).toContain('العربية (Arabic)');
		});
	});

	describe('Language Selection', () => {
		test('updates locale when language is selected', async () => {
			const user = userEvent.setup();
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const spanishOption = screen.getByText('Español (Spanish)');
			await user.click(spanishOption);

			expect(mockLocale.set).toHaveBeenCalledWith('es');
		});

		test('saves selected language to localStorage', async () => {
			const user = userEvent.setup();
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const spanishOption = screen.getByText('Español (Spanish)');
			await user.click(spanishOption);

			expect(localStorage.setItem).toHaveBeenCalledWith('locale', 'es');
		});

		test('closes dropdown after language selection', async () => {
			const user = userEvent.setup();
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			await user.click(button);

			const spanishOption = screen.getByText('Español (Spanish)');
			await user.click(spanishOption);

			await waitFor(() => {
				expect(screen.queryByText('Español (Spanish)')).not.toBeInTheDocument();
			});
		});
	});

	describe('Accessibility', () => {
		test('button has aria-expanded attribute that updates on click', async () => {
			const user = userEvent.setup();
			render(LanguageSwitcher);

			const button = screen.getByRole('button', { name: /select language/i });
			expect(button).toHaveAttribute('aria-expanded', 'false');

			await user.click(button);
			expect(button).toHaveAttribute('aria-expanded', 'true');
		});
	});

	describe('Locale Subscription', () => {
		test('updates displayed language when locale changes', async () => {
			render(LanguageSwitcher);

			// Initially shows English
			expect(screen.getByText('English')).toBeInTheDocument();

			// Simulate locale change
			mockLocale.set('es');

			await waitFor(() => {
				expect(screen.getByText('Español')).toBeInTheDocument();
			});
		});
	});
});
