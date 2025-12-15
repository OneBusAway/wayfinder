<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCircleExclamation, faChevronRight } from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';

	let { alert = $bindable({}), openModal } = $props();
</script>

<div
	class="flex cursor-pointer items-start gap-3 rounded-lg p-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
	role="button"
	tabindex="0"
	onclick={() => openModal(alert)}
	onkeydown={(e) => e.key === 'Enter'}
>
	<div class="mt-2 flex-shrink">
		<FontAwesomeIcon
			icon={faCircleExclamation}
			class="text-green-500"
			style="width: 1.4rem; height: 1.4rem; fill: none; stroke: currentColor; stroke-width: 1.5;"
		/>
	</div>
	<div class="flex-1">
		<h4 class="line-clamp-3 font-medium text-gray-900 dark:text-white">
			{alert?.summary?.value || alert?.description?.value || $t('service_alerts.service_alert')}
		</h4>
		{#if alert?.summary?.value && alert?.description?.value}
			<p class="mt-1 line-clamp-3 text-sm text-gray-500 dark:text-gray-300">
				{alert.description.value}
			</p>
		{/if}
	</div>
	<div class="ml-2 flex-shrink-0">
		<FontAwesomeIcon icon={faChevronRight} class="h-5 w-5 text-gray-400" />
	</div>
</div>
