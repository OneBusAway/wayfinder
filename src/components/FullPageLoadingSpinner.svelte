<script>
	import { t } from 'svelte-i18n';
</script>

<div
	aria-label={$t('loading')}
	role="status"
	aria-live="polite"
	class="flex h-full items-center justify-center bg-neutral-800 bg-gradient-to-br from-zinc-300 to-zinc-700 dark:from-zinc-500"
	role="status"
	aria-live="polite"
	aria-label={$t('loading_page')}
>
	<div class="flex items-center font-semibold text-white">
		<svg
			class="-ml-1 mr-3 h-5 w-5 animate-spin"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
		{$t('loading')}...
	</div>
</div>
