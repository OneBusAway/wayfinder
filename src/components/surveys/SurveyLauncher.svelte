<script>
	import { onDestroy, tick } from 'svelte';
	import { showSurveyModal, surveyStore } from '$stores/surveyStore';

	let currentSurvey;

	const unsubscribe = surveyStore.subscribe((value) => (currentSurvey = value));

	async function launchSurvey() {
		showSurveyModal.set(false);
		await tick();
		showSurveyModal.set(true);
	}

	function shouldShowSurvey(survey) {
		return survey?.show_on_map;
	}

	onDestroy(unsubscribe);
</script>

{#if shouldShowSurvey(currentSurvey)}
	<div
		class="rounded-x w-full border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-black"
	>
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
				{currentSurvey.name}
			</h2>
			<span
				class="rounded-full bg-brand-accent px-3 py-1 text-xs font-medium text-brand-foreground"
			>
				New Survey
			</span>
		</div>

		<p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
			{currentSurvey.questions[0].content.label_text}
		</p>

		<button
			onclick={launchSurvey}
			class="mt-4 flex w-full items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition duration-200 hover:bg-green-700 focus:ring-2 focus:ring-green-400 focus:ring-opacity-50"
		>
			Take Survey
		</button>
	</div>
{/if}
