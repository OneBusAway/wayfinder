<script>
	import SurveyQuestion from '$components/surveys/SurveyQuestion.svelte';
	let {
		currentStopSurvey,
		handleSkip,
		handleSurveyButtonClick,
		handleHeroQuestionChange,
		remainingQuestionsLength
	} = $props();
</script>

<div class="hero-question-container relative rounded-lg bg-gray-50 p-6 shadow dark:bg-gray-800">
	<button
		onclick={handleSkip}
		class="absolute right-2 top-2 text-2xl text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
		title="Skip hero question"
	>
		&times;
	</button>
	<h2 class="h2 mb-4 text-gray-800 dark:text-gray-100">{currentStopSurvey.name}</h2>
	<SurveyQuestion
		question={currentStopSurvey.questions[0]}
		index={0}
		required={currentStopSurvey.questions[0].required}
		onInputChange={handleHeroQuestionChange}
		variant="compact"
		error={[false]}
	/>
	<div class="mt-4 flex justify-end">
		<button
			onclick={handleSurveyButtonClick}
			class="rounded bg-green-500 px-4 py-3 text-sm text-white shadow transition hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
		>
			{remainingQuestionsLength === 0 ? 'Submit' : 'Next'}
		</button>
	</div>
</div>
