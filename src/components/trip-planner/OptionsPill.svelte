<script>
	let { icon = '', label = '' } = $props();
</script>

<span
	class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300"
>
	{#if icon}
		<span class="text-sm">{icon}</span>
	{/if}
	<span>{label}</span>
</span>
