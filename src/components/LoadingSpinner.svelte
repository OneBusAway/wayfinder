<script>
	import { t } from 'svelte-i18n';
</script>

<div
	class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#1C1C1E] bg-opacity-80"
>
	<div class="flex items-center text-white">
		<svg
			class="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path class="opacity-75" fill="currentColor"></path>
		</svg>
		{$t('loading')}...
	</div>
</div>
