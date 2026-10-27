<script lang="ts">
	/**
	 * Compact, collapsible survey banner for the stop pane.
	 *
	 * Owns all presentation state (expanded, answer, error, in-flight) and
	 * delegates the network call to StopPane via handleSurveyButtonClick.
	 */
	import { slide } from 'svelte/transition';
	import { MessageCircleMore, ChevronDown, ChevronUp, X } from '@lucide/svelte';
	import { t } from 'svelte-i18n';
	import type { Survey, SurveyAnswer } from '$stores/surveyStore';
	import SurveyQuestion from '$components/surveys/SurveyQuestion.svelte';

	interface Props {
		currentStopSurvey: Survey | null;
		handleHeroQuestionChange: (answer: SurveyAnswer) => void;
		handleSkip: () => void;
		/** Rejects when the POST fails, so the banner can offer a retry. */
		handleSurveyButtonClick: (survey: Survey) => Promise<void>;
		remainingQuestionsLength?: number;
	}

	let {
		currentStopSurvey,
		handleHeroQuestionChange,
		handleSkip,
		handleSurveyButtonClick,
		remainingQuestionsLength = 0
	}: Props = $props();

	let expanded = $state(false);
	let answer = $state<SurveyAnswer>('');
	let submitting = $state(false);
	let submitFailed = $state(false);

	let heroQuestion = $derived(currentStopSurvey?.questions[0] ?? null);
	let questionType = $derived(heroQuestion?.content.type ?? null);

	// `label` questions are informational, so they submit with no answer —
	// this mirrors the exemption in StopPane.handleSurveyButtonClick.
	let needsAnswer = $derived(questionType !== 'label');

	// An `external_survey` question renders a bare link and never fires a change
	// event, so a Submit button here could never do anything but no-op.
	let showSubmit = $derived(questionType !== 'external_survey');

	let hasAnswer = $derived(Array.isArray(answer) ? answer.length > 0 : answer.trim() !== '');
	let canSubmit = $derived(!submitting && (!needsAnswer || hasAnswer));

	function handleChange(value: SurveyAnswer) {
		answer = value;
		handleHeroQuestionChange(answer);
	}

	async function submit() {
		if (submitting || !currentStopSurvey) return;

		submitting = true;
		submitFailed = false;

		try {
			await handleSurveyButtonClick(currentStopSurvey);
		} catch {
			// StopPane leaves the banner mounted on failure so the user can retry.
			submitFailed = true;
		} finally {
			submitting = false;
		}
	}
</script>

{#if currentStopSurvey && heroQuestion?.content}
	<!-- -mx-4 bleeds to the edges of both containers that host StopPane: the
	     bottom sheet body (px-4) and StandalonePage (p-4). -->
	<div
		class="-mx-4 border-y border-gray-200 bg-primary-100 px-4 dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex items-center gap-3 py-3">
			<span
				aria-hidden="true"
				class="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-accent text-xl text-brand-foreground"
			>
				<MessageCircleMore class="h-5 w-5" />
			</span>

			<button
				type="button"
				onclick={() => (expanded = !expanded)}
				aria-expanded={expanded}
				class="flex min-w-0 flex-1 items-center gap-3 text-left"
			>
				<!-- min-w-0 lets these truncate instead of pushing the buttons off-screen. -->
				<span class="min-w-0 flex-1">
					<span class="block truncate font-bold text-gray-900 dark:text-white">
						{currentStopSurvey.name}
					</span>
					<span class="block truncate text-sm text-gray-600 dark:text-gray-300">
						{heroQuestion.content.label_text}
					</span>
				</span>
				<span class="flex-none text-gray-500 dark:text-gray-400">
					{#if expanded}
						<ChevronUp class="h-4 w-4" />
					{:else}
						<ChevronDown class="h-4 w-4" />
					{/if}
				</span>
				<span class="sr-only">{expanded ? $t('survey.collapse') : $t('survey.expand')}</span>
			</button>

			<button
				type="button"
				onclick={handleSkip}
				aria-label={$t('survey.dismiss')}
				class="flex-none px-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		{#if expanded}
			<!-- 300ms matches AccordionItem, so this opens like the arrival rows below it. -->
			<div transition:slide|local={{ duration: 300 }} class="pb-4">
				<SurveyQuestion
					question={heroQuestion}
					value={answer}
					required={heroQuestion.required}
					onInputChange={handleChange}
					variant="compact"
				/>

				{#if submitFailed}
					<p role="alert" class="mt-2 text-sm text-red-600 dark:text-red-400">
						{$t('survey.submit_failed')}
					</p>
				{/if}

				{#if showSubmit}
					<div class="mt-4 flex justify-end">
						<button
							type="button"
							onclick={submit}
							disabled={!canSubmit}
							class="rounded-lg bg-brand-accent px-6 py-3 text-sm font-semibold text-brand-foreground shadow transition hover:bg-brand-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
						>
							{remainingQuestionsLength === 0 ? $t('survey.submit') : $t('survey.next')}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
