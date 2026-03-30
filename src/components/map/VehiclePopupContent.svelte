<script>
	import { formatLastUpdated } from '$lib/dateTimeFormat';
	import '$lib/i18n';
	import { t } from 'svelte-i18n';

	let { nextDestination, vehicleId, lastUpdateTime, nextStopName, predicted } = $props();

	const lastUpdatedText = formatLastUpdated(lastUpdateTime, {
		min: $t('time.min'),
		sec: $t('time.sec'),
		ago: $t('time.ago')
	});
</script>

<div
	class="max-w-xs rounded-lg bg-white p-4 text-gray-800 shadow-md dark:bg-gray-800 dark:text-gray-100"
>
	<div class="mb-2 flex items-center">
		<div
			class="rounded bg-green-100 px-2 py-1 text-lg font-bold text-brand-accent dark:bg-green-900/30"
		>
			{nextDestination}
		</div>
	</div>
	<div class="text-sm text-gray-600 dark:text-gray-400">
		{#if predicted}
			<span>{$t('vehicle.number')}</span>
			<span class="font-semibold text-blue-500 dark:text-blue-400">{vehicleId || $t('NA')}</span> |
			<span>{$t('vehicle.data_updated')}</span>
			<span class="font-semibold text-blue-500 dark:text-blue-400">{lastUpdatedText}</span>
		{:else}
			<span class="font-semibold text-gray-500 dark:text-gray-400"
				>{$t('vehicle.no_real_time_data')}</span
			>
		{/if}
	</div>
	<hr class="my-2 dark:border-gray-700" />
	<div class="text-sm font-bold text-gray-800 dark:text-gray-100">{$t('vehicle.next_stop')}</div>
	<div class="text-sm text-gray-600 dark:text-gray-400">
		<strong class="font-semibold text-blue-500 dark:text-blue-400"
			>{nextStopName || $t('NA')}</strong
		>
	</div>
	<hr class="my-2 dark:border-gray-700" />
</div>
