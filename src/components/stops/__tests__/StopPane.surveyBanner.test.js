// Integration coverage for StopPane.handleSurveyButtonClick exercised through
// the REAL SurveyBanner component (StopPane.test.js mocks SurveyBanner, and
// SurveyBanner.test.js mocks handleSurveyButtonClick, so the contract between
// them was previously untested from either end). Covers four fixed behaviors:
//   (a) the array-aware empty guard (heroAnswerIsEmpty handles string[] from
//       checkbox questions)
//   (b) remainingQuestionsLength derived at render time from the question
//       count, not from post-click state
//   (c) showSurveyModal.set(true) firing only AFTER a successful POST
//   (d) the try/catch that rethrows so the banner can show its retry message
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import StopPane from '../StopPane.svelte';
import {
	mockStopData,
	mockArrivalsAndDeparturesResponse
} from '../../../tests/fixtures/obaData.js';

// SurveyBanner is intentionally left unmocked here so the real handler
// contract (props in, POST out) is exercised end to end.
vi.mock('$components/ArrivalDeparture.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/oba/TripDetailsPane.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/containers/SingleSelectAccordion.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({
		$set: vi.fn(),
		$destroy: vi.fn(),
		$on: vi.fn(),
		handleAccordionSelectionChanged: vi.fn()
	}))
}));

vi.mock('$components/containers/AccordionItem.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/surveys/SurveyModal.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/service-alerts/ServiceAlerts.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$components/LoadingSpinner.svelte', () => ({
	default: vi.fn().mockImplementation(() => ({ $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn() }))
}));

vi.mock('$stores/surveyStore', () => ({
	surveyStore: {
		subscribe: vi.fn((fn) => {
			fn(null);
			return { unsubscribe: () => {} };
		})
	},
	showSurveyModal: {
		set: vi.fn()
	},
	markSurveyAnswered: vi.fn()
}));

vi.mock('$lib/Surveys/surveyUtils', () => ({
	submitHeroQuestion: vi.fn().mockResolvedValue('survey-response-1'),
	skipSurvey: vi.fn()
}));

vi.mock('$lib/utils/user', () => ({
	getUserId: vi.fn().mockReturnValue('user-123')
}));

vi.mock('$lib/Insights', () => ({
	default: { reportArrivalClicked: vi.fn() }
}));

vi.mock('$components/service-alerts/serviceAlertsHelper', () => ({
	filterActiveAlerts: vi.fn((alerts) => alerts || [])
}));

vi.mock('svelte-i18n', () => ({
	// Fall back to returning the raw key, same pattern SurveyBanner.test.js
	// uses, so e.g. 'survey.submit' / 'survey.next' are directly assertable.
	t: {
		subscribe: vi.fn((fn) => {
			fn((key, options) => {
				const translations = {
					stop: 'Stop',
					routes: 'Routes'
				};
				let str = translations[key] || key;
				if (options?.values) {
					for (const [name, value] of Object.entries(options.values)) {
						str = str.replace(`{${name}}`, value);
					}
				}
				return str;
			});
			return { unsubscribe: () => {} };
		})
	},
	isLoading: {
		subscribe: vi.fn((fn) => {
			fn(false);
			return { unsubscribe: () => {} };
		})
	}
}));

global.fetch = vi.fn();

function surveyWithQuestions(contents) {
	return {
		id: 'survey_42',
		name: 'Rider Feedback',
		questions: contents.map((content, i) => ({ id: `q${i + 1}`, required: true, content }))
	};
}

const checkboxContent = {
	type: 'checkbox',
	label_text: 'Which amenities does this stop have?',
	options: ['Shelter', 'Bench', 'Lighting']
};

const radioContent = {
	type: 'radio',
	label_text: 'How was your trip?',
	options: ['Great', 'OK', 'Bad']
};

async function renderWithSurvey(survey) {
	const { surveyStore } = await import('$stores/surveyStore');
	vi.mocked(surveyStore.subscribe).mockImplementation((fn) => {
		fn(survey);
		return { unsubscribe: () => {} };
	});

	global.fetch.mockResolvedValue({
		ok: true,
		status: 200,
		json: async () => mockArrivalsAndDeparturesResponse
	});

	render(StopPane, {
		props: { stop: mockStopData, handleUpdateRouteMap: vi.fn(), tripSelected: vi.fn() }
	});

	await waitFor(() => {
		expect(screen.getByText('Pine St & 3rd Ave')).toBeInTheDocument();
	});

	const user = userEvent.setup();
	await user.click(screen.getByRole('button', { name: /survey.expand/ }));
	return user;
}

describe('StopPane.handleSurveyButtonClick (via real SurveyBanner)', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		global.fetch.mockReset();

		const { submitHeroQuestion } = await import('$lib/Surveys/surveyUtils');
		vi.mocked(submitHeroQuestion).mockReset().mockResolvedValue('survey-response-1');
	});

	test('(a) posts a string[] answer for a checkbox question instead of treating it as empty', async () => {
		const survey = surveyWithQuestions([checkboxContent]);
		const user = await renderWithSurvey(survey);

		await user.click(screen.getByLabelText('Shelter'));
		await user.click(screen.getByLabelText('Lighting'));
		await user.click(screen.getByRole('button', { name: 'survey.submit' }));

		const { submitHeroQuestion } = await import('$lib/Surveys/surveyUtils');
		await waitFor(() => expect(submitHeroQuestion).toHaveBeenCalledTimes(1));

		const posted = vi.mocked(submitHeroQuestion).mock.calls[0][0];
		expect(posted.responses[0].answer).toEqual(['Shelter', 'Lighting']);
	});

	test('(b) reads "Next" before any submit, driven by the render-time question count', async () => {
		const survey = surveyWithQuestions([radioContent, radioContent]);
		await renderWithSurvey(survey);

		// remainingSurveyQuestions (post-click state) is still [] at this point;
		// the label must come from currentStopSurvey.questions.length instead.
		expect(screen.getByRole('button', { name: 'survey.next' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'survey.submit' })).not.toBeInTheDocument();
	});

	test('(c) calls showSurveyModal.set(true) only after the POST resolves, not before', async () => {
		const survey = surveyWithQuestions([radioContent, radioContent]);
		const user = await renderWithSurvey(survey);

		let releasePost;
		const { submitHeroQuestion } = await import('$lib/Surveys/surveyUtils');
		vi.mocked(submitHeroQuestion).mockImplementation(
			() => new Promise((resolve) => (releasePost = () => resolve('survey-response-1')))
		);

		const { showSurveyModal } = await import('$stores/surveyStore');

		await user.click(screen.getByLabelText('Great'));
		await user.click(screen.getByRole('button', { name: 'survey.next' }));

		// The POST is in flight: showSurveyModal must NOT have been set yet.
		// This assertion fails if `showSurveyModal.set(true)` is moved above
		// the `await submitHeroQuestion(...)` call in StopPane.
		expect(showSurveyModal.set).not.toHaveBeenCalled();

		releasePost();
		await waitFor(() => expect(showSurveyModal.set).toHaveBeenCalledWith(true));
	});

	test('(d) rethrows a failed POST so the banner shows a retry message and does not advance', async () => {
		const survey = surveyWithQuestions([radioContent]);
		const user = await renderWithSurvey(survey);

		const { submitHeroQuestion } = await import('$lib/Surveys/surveyUtils');
		vi.mocked(submitHeroQuestion).mockRejectedValue(new Error('network down'));

		const { showSurveyModal, markSurveyAnswered } = await import('$stores/surveyStore');

		await user.click(screen.getByLabelText('Great'));
		await user.click(screen.getByRole('button', { name: 'survey.submit' }));

		await waitFor(() => {
			expect(screen.getByText('survey.submit_failed')).toBeInTheDocument();
		});

		// The banner must stay mounted (showHeroQuestion untouched) and the
		// success-only side effects must never fire.
		expect(screen.getByRole('button', { name: 'survey.submit' })).toBeInTheDocument();
		expect(showSurveyModal.set).not.toHaveBeenCalled();
		expect(markSurveyAnswered).not.toHaveBeenCalled();
	});
});
