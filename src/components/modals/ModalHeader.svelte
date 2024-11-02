<script>
	export let title;
	export let subtitle = null;
	export let caption = null;
</script>

<div class="modal-header">
	<h2 class="h2 mb-0 text-white">{title}</h2>
	{#if subtitle}
		<h3 class="h3 mb-0 text-white">{subtitle}</h3>
	{/if}
	{#if caption}
		<h4 class="h4 mb-0 text-white">{caption}</h4>
	{/if}
</div>

<style type="postcss">
	.modal-header {
		@apply flex flex-col rounded-lg bg-[#1C1C1E] bg-opacity-80 px-4 py-2;
	}
</style>
