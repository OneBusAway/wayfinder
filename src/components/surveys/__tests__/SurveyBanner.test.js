import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import SurveyBanner from '../SurveyBanner.svelte';

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
			return { unsubscribe: () => {} };
		})
	}
}));

function surveyWithHero(content, { required = true } = {}) {
	return {
		id: 7,
		name: 'How easy is OneBusAway to use?',
		questions: [{ id: 1, required, content }]
	};
}

const radioContent = {
	type: 'radio',
	label_text: 'How easy was it to navigate and use the app?',
	options: ['Very Easy', 'Neutral', 'Very Difficult']
};

function defaultProps(overrides = {}) {
	return {
		currentStopSurvey: surveyWithHero(radioContent),
		handleSkip: vi.fn(),
		handleSurveyButtonClick: vi.fn().mockResolvedValue(undefined),
		handleHeroQuestionChange: vi.fn(),
		remainingQuestionsLength: 0,
		...overrides
	};
}

describe('SurveyBanner — collapsed', () => {
	let user;

	beforeEach(() => {
		user = userEvent.setup();
	});

	test('renders nothing when the survey has no questions', () => {
		const { container } = render(SurveyBanner, {
			props: defaultProps({ currentStopSurvey: { id: 7, name: 'Empty', questions: [] } })
		});

		expect(container.textContent.trim()).toBe('');
	});

	test('renders nothing when there is no survey at all', () => {
		const { container } = render(SurveyBanner, {
			props: defaultProps({ currentStopSurvey: null })
		});

		expect(container.textContent.trim()).toBe('');
	});

	test('shows the survey name and the hero question, collapsed by default', () => {
		render(SurveyBanner, { props: defaultProps() });

		expect(screen.getByText('How easy is OneBusAway to use?')).toBeInTheDocument();
		expect(screen.getByText(radioContent.label_text)).toBeInTheDocument();

		const toggle = screen.getByRole('button', { name: /survey.expand/ });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');

		// The answer options belong to the body, which is collapsed.
		expect(screen.queryByLabelText('Very Easy')).not.toBeInTheDocument();
	});

	test('renders no heading elements', () => {
		render(SurveyBanner, { props: defaultProps() });

		expect(screen.queryAllByRole('heading')).toHaveLength(0);
	});

	test('toggling expands the banner and updates aria-expanded', async () => {
		render(SurveyBanner, { props: defaultProps() });

		await user.click(screen.getByRole('button', { name: /survey.expand/ }));

		expect(screen.getByRole('button', { name: /survey.collapse/ })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		expect(screen.getByLabelText('Very Easy')).toBeInTheDocument();
	});

	test('dismiss calls handleSkip and not the submit handler', async () => {
		const props = defaultProps();
		render(SurveyBanner, { props });

		await user.click(screen.getByRole('button', { name: 'survey.dismiss' }));

		expect(props.handleSkip).toHaveBeenCalledTimes(1);
		expect(props.handleSurveyButtonClick).not.toHaveBeenCalled();
	});
});
