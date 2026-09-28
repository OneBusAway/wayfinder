<script>
	import TabLink from '../../components/tabs/TabLink.svelte';

	let { current = false, href = '/stops', label = 'Stops' } = $props();
</script>

<TabLink {current} {href}>
	{label}
</TabLink>
