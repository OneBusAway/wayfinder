<script>
	import TabContainer from '../../components/tabs/TabContainer.svelte';
	let { text = 'Test Tab Content' } = $props();
</script>

<TabContainer>
	<div data-testid="tab-child">{text}</div>
</TabContainer>
