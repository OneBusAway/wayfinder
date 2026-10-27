<script lang="ts">
	import { onDestroy } from 'svelte';
	import { t } from 'svelte-i18n';
	import * as Dialog from '$components/ui/dialog';
	import { Button } from '$components/ui/button';
	import SurveyQuestion from './SurveyQuestion.svelte';
	import {
		submitHeroQuestion as submitHeroQuestionUtil,
		updateSurveyResponse as updateSurveyResponseUtil,
		skipSurvey,
		submitSurvey
	} from '$lib/Surveys/surveyUtils';

	import { surveyStore } from '$stores/surveyStore';
	import type {
		Survey,
		SurveyAnswer,
		SurveyQuestion as SurveyQuestionData
	} from '$stores/surveyStore';
	import { getUserId } from '$lib/utils/user';
	import type { Stop } from '$lib/types';
	import SurveySubmitted from './SurveySubmitted.svelte';

	interface SurveyAnswerResponse {
		answer: SurveyAnswer | null;
		question_id: SurveyQuestionData['id'];
		question_label: string;
		question_type: string;
	}

	interface Props {
		/** Asks the parent to close the dialog. */
		onClose: () => void;
		skipHeroQuestion?: boolean;
		stop?: Stop | null;
		surveyPublicId?: string | null;
	}

	let { onClose, skipHeroQuestion, stop = null, surveyPublicId }: Props = $props();

	let userAnswers: SurveyAnswer[] = $state([]);
	let heroQuestionAnswered = $state(false);
	let surveyPublicIdentifier: string | null = $state(null);
	let surveySubmitted = $state(false);
	let submitting = $state(false);
	let submitFailed = $state(false);
	let errors: boolean[] = $state([]);
	let closeTimer: ReturnType<typeof setTimeout> | undefined;

	let currentSurvey: Survey | null = $state($surveyStore);

	let heroQuestion: SurveyQuestionData | null = $state(currentSurvey?.questions?.[0] ?? null);
	let remainingQuestions: SurveyQuestionData[] = $state(currentSurvey?.questions?.slice(1) ?? []);

	let surveyResponse: {
		responses: SurveyAnswerResponse[];
		stop_identifier: Stop['id'] | null;
		stop_latitude: Stop['lat'] | null;
		stop_longitude: Stop['lon'] | null;
		survey_id: Survey['id'] | null;
		user_identifier: string;
	} = {
		responses: [],
		stop_identifier: stop?.id ?? null,
		stop_latitude: stop?.lat ?? null,
		stop_longitude: stop?.lon ?? null,
		survey_id: currentSurvey?.id ?? null,
		user_identifier: getUserId()
	};

	function handleInputChange(question: SurveyQuestionData, index: number, answer: SurveyAnswer) {
		if (Array.isArray(answer) && answer.length === 0) {
			delete userAnswers[index];
		} else {
			userAnswers[index] = answer;
		}

		surveyResponse.responses[index] = {
			question_id: question.id,
			question_label: question.content.label_text,
			question_type: question.content.type,
			answer: userAnswers[index] || null
		};
	}

	function validateAnswers() {
		let valid = true;
		errors = new Array(currentSurvey?.questions.length ?? 0).fill(false);

		if (!heroQuestionAnswered && !skipHeroQuestion) {
			if (heroQuestion?.required && (!userAnswers[0] || userAnswers[0].length === 0)) {
				errors[0] = true;
				valid = false;
			}
		} else {
			remainingQuestions.forEach((question, index) => {
				const answer = userAnswers[index + 1];
				if (question.required && (!answer || (Array.isArray(answer) && answer.length === 0))) {
					errors[index + 1] = true;
					valid = false;
				}
			});
		}

		return valid;
	}

	async function submitHeroQuestion() {
		if (submitting || !validateAnswers()) return;

		submitting = true;
		submitFailed = false;
		try {
			surveyPublicIdentifier = await submitHeroQuestionUtil(surveyResponse);
			heroQuestionAnswered = true;
			submitSurvey(currentSurvey);

			if (remainingQuestions.length === 0) {
				showConfirmation();
			}
		} catch (error) {
			console.error('Error submitting hero question:', error);
			submitFailed = true;
		} finally {
			submitting = false;
		}
	}

	async function updateSurveyResponse() {
		if (surveyPublicId) surveyPublicIdentifier = surveyPublicId;
		return updateSurveyResponseUtil(surveyPublicIdentifier, surveyResponse);
	}

	async function handleSubmit() {
		if (submitting || !validateAnswers()) return;

		submitting = true;
		submitFailed = false;
		try {
			await updateSurveyResponse();
			submitSurvey(currentSurvey);
			showConfirmation();
		} catch (error) {
			// Leave the form open so the user can retry.
			console.error('Error updating survey response:', error);
			submitFailed = true;
		} finally {
			submitting = false;
		}
	}

	function showConfirmation() {
		surveySubmitted = true;
		// Leave the confirmation up long enough to read before closing.
		closeTimer = setTimeout(onClose, 3000);
	}

	function skip() {
		skipSurvey(currentSurvey);
		onClose();
	}

	/** Treats closing the dialog before submitting like the Cancel/Skip buttons. */
	export function dismiss() {
		if (currentSurvey && !surveySubmitted) skipSurvey(currentSurvey);
	}

	onDestroy(() => clearTimeout(closeTimer));
</script>

{#if currentSurvey}
	<Dialog.Header>
		<Dialog.Title>{currentSurvey.name}</Dialog.Title>
	</Dialog.Header>
	{#if surveySubmitted}
		<SurveySubmitted />
	{:else}
		<div class="-mx-4 overflow-y-auto px-4">
			{#if !heroQuestionAnswered && !skipHeroQuestion}
				{#if heroQuestion}
					{@const question = heroQuestion}
					<SurveyQuestion
						{question}
						value={userAnswers[0]}
						onInputChange={(answer) => handleInputChange(question, 0, answer)}
						required={question.required}
						error={errors[0]}
					/>
				{/if}
			{:else}
				<div class="flex flex-col gap-6">
					{#each remainingQuestions as question, index (question.id)}
						<SurveyQuestion
							{question}
							value={userAnswers[index + 1]}
							onInputChange={(answer) => handleInputChange(question, index + 1, answer)}
							required={question.required}
							error={errors[index + 1]}
						/>
					{/each}
				</div>
			{/if}
		</div>

		{#if submitFailed}
			<p role="alert" class="text-sm text-destructive">{$t('survey.submit_failed')}</p>
		{/if}

		{#if !heroQuestionAnswered && !skipHeroQuestion}
			<Dialog.Footer>
				<Button onclick={skip} variant="outline">Cancel</Button>
				<Button onclick={submitHeroQuestion} disabled={submitting}>
					{remainingQuestions.length === 0 ? 'Submit' : 'Next'}
				</Button>
			</Dialog.Footer>
		{:else if remainingQuestions.length > 0}
			<Dialog.Footer>
				<Button onclick={skip} variant="outline">Skip</Button>
				<Button onclick={handleSubmit} disabled={submitting}>Submit</Button>
			</Dialog.Footer>
		{/if}
	{/if}
{/if}
