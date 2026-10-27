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
		onHeroQuestionChange: vi.fn(),
		onSkip: vi.fn(),
		onSurveyButtonClick: vi.fn().mockResolvedValue(undefined),
		remainingQuestionsLength: 0,
		stopSurvey: surveyWithHero(radioContent),
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
			props: defaultProps({ stopSurvey: { id: 7, name: 'Empty', questions: [] } })
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

	test('dismiss calls onSkip and not the submit handler', async () => {
		const props = defaultProps();
		render(SurveyBanner, { props });

		await user.click(screen.getByRole('button', { name: 'survey.dismiss' }));

		expect(props.onSkip).toHaveBeenCalledTimes(1);
		expect(props.onSurveyButtonClick).not.toHaveBeenCalled();
	});
});

describe('SurveyBanner — expanded', () => {
	let user;

	beforeEach(() => {
		user = userEvent.setup();
	});

	async function renderExpanded(overrides = {}) {
		const props = defaultProps(overrides);
		render(SurveyBanner, { props });
		await user.click(screen.getByRole('button', { name: /survey.expand/ }));
		return props;
	}

	test('submit is disabled until an answer is selected', async () => {
		await renderExpanded();

		const submitButton = screen.getByRole('button', { name: 'survey.submit' });
		expect(submitButton).toBeDisabled();

		await user.click(screen.getByLabelText('Very Easy'));

		expect(submitButton).toBeEnabled();
	});

	test('reports the resolved answer upward, not the event', async () => {
		const props = await renderExpanded();

		await user.click(screen.getByLabelText('Neutral'));

		expect(props.onHeroQuestionChange).toHaveBeenCalledWith('Neutral');
	});

	test('never shows the required message unprompted', async () => {
		// Submit stays disabled until answered (canSubmit), so the banner never
		// passes an error flag to SurveyQuestion -- the required-answer message
		// is unreachable by design, not just by this test's interactions.
		await renderExpanded();

		expect(screen.queryByText('survey.required_answer')).not.toBeInTheDocument();

		await user.click(screen.getByLabelText('Very Easy'));
		expect(screen.queryByText('survey.required_answer')).not.toBeInTheDocument();
	});

	test('checkbox answers accumulate and unchecking removes them', async () => {
		const props = await renderExpanded({
			stopSurvey: surveyWithHero({
				type: 'checkbox',
				label_text: 'Which amenities does this stop have?',
				options: ['Shelter', 'Bench', 'Lighting']
			})
		});

		const submitButton = screen.getByRole('button', { name: 'survey.submit' });

		await user.click(screen.getByLabelText('Shelter'));
		await user.click(screen.getByLabelText('Bench'));
		expect(props.onHeroQuestionChange).toHaveBeenLastCalledWith(['Shelter', 'Bench']);

		await user.click(screen.getByLabelText('Shelter'));
		expect(props.onHeroQuestionChange).toHaveBeenLastCalledWith(['Bench']);
		expect(submitButton).toBeEnabled();

		await user.click(screen.getByLabelText('Bench'));
		expect(props.onHeroQuestionChange).toHaveBeenLastCalledWith([]);
		expect(submitButton).toBeDisabled();
	});

	test('a label question can be submitted with no answer', async () => {
		const props = await renderExpanded({
			stopSurvey: surveyWithHero(
				{ type: 'label', label_text: 'Thanks for riding with us.' },
				{ required: false }
			)
		});

		const submitButton = screen.getByRole('button', { name: 'survey.submit' });
		expect(submitButton).toBeEnabled();

		await user.click(submitButton);
		expect(props.onSurveyButtonClick).toHaveBeenCalledTimes(1);
	});

	test('an external_survey question renders a link and no submit button', async () => {
		await renderExpanded({
			stopSurvey: surveyWithHero({
				type: 'external_survey',
				label_text: 'Take our rider survey',
				url: 'https://example.com/survey'
			})
		});

		expect(screen.getByRole('link', { name: 'Take our rider survey' })).toHaveAttribute(
			'href',
			'https://example.com/survey'
		);
		expect(screen.queryByRole('button', { name: 'survey.submit' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'survey.next' })).not.toBeInTheDocument();
	});

	test('reads "next" when the survey has more questions', async () => {
		await renderExpanded({ remainingQuestionsLength: 3 });

		expect(screen.getByRole('button', { name: 'survey.next' })).toBeInTheDocument();
	});

	test('submit is disabled while in flight and the handler is called once', async () => {
		let release;
		const onSurveyButtonClick = vi.fn(() => new Promise((resolve) => (release = resolve)));
		await renderExpanded({ onSurveyButtonClick });

		await user.click(screen.getByLabelText('Very Easy'));
		const submitButton = screen.getByRole('button', { name: 'survey.submit' });

		await user.click(submitButton);
		expect(submitButton).toBeDisabled();

		release();
		await vi.waitFor(() => expect(submitButton).toBeEnabled());
		expect(onSurveyButtonClick).toHaveBeenCalledTimes(1);
	});

	test('a rejected submit shows the failure message and re-enables submit', async () => {
		await renderExpanded({
			onSurveyButtonClick: vi.fn().mockRejectedValue(new Error('network down'))
		});

		await user.click(screen.getByLabelText('Very Easy'));
		await user.click(screen.getByRole('button', { name: 'survey.submit' }));

		await vi.waitFor(() => expect(screen.getByText('survey.submit_failed')).toBeInTheDocument());
		expect(screen.getByRole('button', { name: 'survey.submit' })).toBeEnabled();
	});
});
