<script>
	let { class: className = '', size = 24, ...rest } = $props();
</script>

<svg
	class={className}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	aria-hidden="true"
	data-lucide="stub"
	{...rest}
></svg>
