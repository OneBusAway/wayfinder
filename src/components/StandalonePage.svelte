<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="mx-auto h-full max-w-5xl overflow-y-auto p-4">
	{@render children?.()}
</div>
