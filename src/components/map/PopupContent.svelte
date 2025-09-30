<script>
	import { t } from 'svelte-i18n';
	import { formatSecondsFromMidnight } from '$lib/formatters';
	let { stopName, arrivalTime, handleStopMarkerSelect } = $props();
</script>

<div class="transform rounded-lg bg-white p-4 shadow-lg">
	<h3 class="text-xl font-bold text-gray-900">{stopName}</h3>

	{#if arrivalTime != null}
		<p class="my-4 flex items-center text-gray-700">
			<span class="mr-2 rounded-md bg-purple-600 px-2 py-1 text-white">Arrival time:</span>
			<span>{formatSecondsFromMidnight(arrivalTime)}</span>
		</p>
	{/if}
	<div class="mt-auto flex justify-center">
		<button
			type="button"
			class="inline-block rounded-lg border border-brand bg-brand px-3 py-1 text-sm font-medium text-white shadow-md transition duration-200 ease-in-out hover:bg-brand-secondary"
			onclick={handleStopMarkerSelect}
		>
			{$t('view_stop_information')}
		</button>
	</div>
</div>
