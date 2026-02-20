<script>
	import { t } from 'svelte-i18n';
	let { onStartHere, onEndHere } = $props();
</script>

<div class="rounded-lg bg-white p-3 dark:bg-gray-800">
	<h3 class="mb-2 text-sm font-bold text-gray-900 dark:text-white">{$t('tabs.plan_trip')}</h3>
	<div class="flex flex-col gap-1.5">
		<button
			type="button"
			class="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand-accent"
			onclick={onStartHere}
		>
			{$t('context-menu.start_here')}
		</button>
		<button
			type="button"
			class="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand-accent"
			onclick={onEndHere}
		>
			{$t('context-menu.end_here')}
		</button>
	</div>
</div>
