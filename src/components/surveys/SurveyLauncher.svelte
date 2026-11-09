<script lang="ts">
	import { Button } from '$components/ui/button';
	import { showSurveyModal, surveyStore } from '$stores/surveyStore';

	function launchSurvey() {
		showSurveyModal.set(true);
	}
</script>

{#if $surveyStore?.show_on_map}
	<div
		class="rounded border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700 dark:bg-black"
	>
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
				{$surveyStore.name}
			</h2>
			<span
				class="rounded-full bg-brand-accent px-3 py-1 text-xs font-medium text-brand-foreground"
			>
				New Survey
			</span>
		</div>
		<p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
			{$surveyStore.questions[0].content.label_text}
		</p>
		<Button onclick={launchSurvey} class="mt-4 w-full">Take Survey</Button>
	</div>
{/if}
