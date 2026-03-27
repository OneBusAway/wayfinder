<script>
	let { icon = '', label = '', active = false, onclick } = $props();
</script>

<span
	class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300"
	class:bg-gray-100={!active}
	class:bg-gray-200={active}
	class:dark:bg-gray-700={!active}
	class:dark:bg-gray-600={active}
	class:ring-2={active}
	class:ring-brand={active}
	class:font-semibold={active}
	data-testid={active ? 'options-pill-active' : undefined}
	role={onclick ? 'button' : undefined}
	{onclick}
>
	{#if icon}
		<span class="text-sm">{icon}</span>
	{/if}
	<span>{label}</span>
</span>
