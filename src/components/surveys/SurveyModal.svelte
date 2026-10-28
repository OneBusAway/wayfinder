<script lang="ts">
	import * as Dialog from '$components/ui/dialog';
	import type { Stop } from '$lib/types';
	import SurveyForm from './SurveyForm.svelte';

	interface Props {
		open?: boolean;
		skipHeroQuestion?: boolean;
		stop?: Stop | null;
		surveyPublicId?: string | null;
	}

	let { open = $bindable(false), skipHeroQuestion, stop = null, surveyPublicId }: Props = $props();

	let form: ReturnType<typeof SurveyForm> | undefined = $state();

	// Fires only for the dialog's own dismissals (close button, Escape, outside
	// click), not when `open` is set from code.
	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) form?.dismiss();
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="flex max-h-[85vh] flex-col sm:max-w-2xl">
		<!-- The form unmounts with the content after the close animation, so each
		     open starts with fresh answers and no pending auto-close timer. -->
		<SurveyForm
			bind:this={form}
			onClose={() => (open = false)}
			{skipHeroQuestion}
			{stop}
			{surveyPublicId}
		/>
	</Dialog.Content>
</Dialog.Root>
