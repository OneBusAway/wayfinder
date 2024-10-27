<script>
	import { formatLastUpdated } from '$lib/formatters';
	import '$lib/i18n';
	import { t } from 'svelte-i18n';

	export let nextDestination;
	export let vehicleId;
	export let lastUpdateTime;
	export let nextStopName;
	export let predicted;

	const lastUpdatedText = formatLastUpdated(lastUpdateTime, {
		min: $t('time.min'),
		sec: $t('time.sec'),
		ago: $t('time.ago')
	});
</script>

<div class="max-w-xs rounded-lg bg-white p-4 text-gray-800 shadow-md">
	<div class="mb-2 flex items-center">
		<div class="rounded bg-green-100 px-2 py-1 text-lg font-bold text-green-600">
			{nextDestination}
		</div>
	</div>
	<div class="text-sm text-gray-600">
		{#if predicted}
			<span>{$t('vehicle.number')}</span>
			<span class="font-semibold text-blue-500">{vehicleId || $t('NA')}</span> |
			<span>{$t('vehicle.data_updated')}</span>
			<span class="font-semibold text-blue-500">{lastUpdatedText}</span>
		{:else}
			<span class="font-semibold text-gray-500">{$t('vehicle.no_real_time_data')}</span>
		{/if}
	</div>
	<hr class="my-2" />
	<div class="text-sm font-bold text-gray-800">{$t('vehicle.next_stop')}</div>
	<div class="text-sm text-gray-600">
		<strong class="font-semibold text-blue-500">{nextStopName || $t('NA')}</strong>
	</div>
	<hr class="my-2" />
</div>
