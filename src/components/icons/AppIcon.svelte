<!--
	@component
	Renders either a Lucide component or a Font Awesome icon definition. Transit
	mode icons are Font Awesome (see #643); everything else is Lucide. Use this
	where one slot can hold either kind, e.g. a search result that is a route or
	a location.

	@prop {import('svelte').Component | import('@fortawesome/fontawesome-svg-core').IconDefinition} icon
	@prop {string} [class]
-->
<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	let { icon, class: className = '', ...rest } = $props();

	const isFontAwesome = $derived(typeof icon === 'object' && icon !== null && 'iconName' in icon);
</script>

{#if isFontAwesome}
	<FontAwesomeIcon {icon} class={className} {...rest} />
{:else if icon}
	{@const Icon = icon}
	<Icon class={className} {...rest} />
{/if}
