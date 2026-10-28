import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import SurveyModal from '../SurveyModal.svelte';
import { surveyStore } from '$stores/surveyStore';
import type { Survey, SurveyQuestion } from '$stores/surveyStore';
import {
	skipSurvey,
	submitHeroQuestion,
	submitSurvey,
	updateSurveyResponse
} from '$lib/Surveys/surveyUtils';

vi.mock('$lib/Surveys/surveyUtils', () => ({
	skipSurvey: vi.fn(),
	submitHeroQuestion: vi.fn(),
	submitSurvey: vi.fn(),
	updateSurveyResponse: vi.fn()
}));

vi.mock('$lib/utils/user', () => ({
	getUserId: vi.fn(() => 'user-1')
}));

const radioQuestion = (id: number): SurveyQuestion => ({
	content: { label_text: `Question ${id}`, options: ['Great', 'Okay'], type: 'radio' },
	id,
	required: true
});

function useSurvey(questionCount: number): Survey {
	const survey: Survey = {
		id: 7,
		name: 'Rider survey',
		questions: Array.from({ length: questionCount }, (_, i) => radioQuestion(i + 1)),
		show_on_map: true
	};
	surveyStore.set(survey);
	return survey;
}

/** A promise that stays pending until `release` is called. */
function deferred<T>() {
	let release!: (value: T) => void;
	const promise = new Promise<T>((resolve) => (release = resolve));
	return { promise, release };
}

describe('SurveyModal', () => {
	let user: UserEvent;

	beforeEach(() => {
		vi.clearAllMocks();
		user = userEvent.setup();
	});

	afterEach(() => {
		surveyStore.set(null);
		vi.useRealTimers();
	});

	test('closing with Escape before submitting records a skip', async () => {
		const survey = useSurvey(1);
		render(SurveyModal, { props: { open: true } });

		await user.keyboard('{Escape}');

		expect(skipSurvey).toHaveBeenCalledTimes(1);
		expect(skipSurvey).toHaveBeenCalledWith(survey);
	});

	test('Cancel records a single skip and closes the dialog', async () => {
		useSurvey(1);
		render(SurveyModal, { props: { open: true } });

		await user.click(screen.getByRole('button', { name: 'survey.cancel' }));

		expect(skipSurvey).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	test('closing after the confirmation does not record a skip', async () => {
		useSurvey(1);
		vi.mocked(submitHeroQuestion).mockResolvedValue('response-1');
		render(SurveyModal, { props: { open: true } });

		await user.click(screen.getByLabelText('Great'));
		await user.click(screen.getByRole('button', { name: 'survey.submit' }));
		await screen.findByText('survey.thank_you');

		await user.keyboard('{Escape}');

		expect(skipSurvey).not.toHaveBeenCalled();
	});

	test('closing while a submit is pending does not record a skip', async () => {
		useSurvey(1);
		const { promise } = deferred<string>();
		vi.mocked(submitHeroQuestion).mockReturnValue(promise);
		render(SurveyModal, { props: { open: true } });

		await user.click(screen.getByLabelText('Great'));
		await user.click(screen.getByRole('button', { name: 'survey.submit' }));
		await user.keyboard('{Escape}');

		expect(skipSurvey).not.toHaveBeenCalled();
	});

	test('repeated clicks send the answer once while the submit is pending', async () => {
		useSurvey(1);
		const { promise, release } = deferred<string>();
		vi.mocked(submitHeroQuestion).mockReturnValue(promise);
		render(SurveyModal, { props: { open: true } });

		await user.click(screen.getByLabelText('Great'));
		const submit = screen.getByRole('button', { name: 'survey.submit' });
		await user.click(submit);
		await user.click(submit);

		expect(submitHeroQuestion).toHaveBeenCalledTimes(1);
		release('response-1');
		await screen.findByText('survey.thank_you');
	});

	test('a failed update keeps the form open with an error and does not mark it submitted', async () => {
		useSurvey(2);
		vi.mocked(updateSurveyResponse).mockRejectedValue(new Error('network down'));
		render(SurveyModal, {
			props: { open: true, skipHeroQuestion: true, surveyPublicId: 'response-1' }
		});

		await user.click(screen.getByLabelText('Great'));
		await user.click(screen.getByRole('button', { name: 'survey.submit' }));

		expect(await screen.findByText('survey.submit_failed')).toBeInTheDocument();
		expect(submitSurvey).not.toHaveBeenCalled();
		expect(screen.queryByText('survey.thank_you')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'survey.submit' })).toBeEnabled();
	});

	test('closes on its own 3 seconds after the confirmation', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		useSurvey(1);
		vi.mocked(submitHeroQuestion).mockResolvedValue('response-1');
		render(SurveyModal, { props: { open: true } });

		await user.click(screen.getByLabelText('Great'));
		await user.click(screen.getByRole('button', { name: 'survey.submit' }));
		await screen.findByText('survey.thank_you');

		vi.advanceTimersByTime(3000);

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(skipSurvey).not.toHaveBeenCalled();
	});
});
