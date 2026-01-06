<script>
	import { faCaretUp } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	/**
	 * @typedef {Object} Props
	 * @property {any} stop
	 * @property {any} onClick
	 * @property {any} icon
	 * @property {boolean} [isHighlighted]
	 * @property {boolean} [showRoutesLabel]
	 */

	/** @type {Props} */
	let { stop, onClick, icon, isHighlighted = false, showRoutesLabel = false } = $props();

	const MAX_ROUTES_TO_SHOW = 3;
	let isExpanded = $state(false);

	const routeNames = $derived(
		(stop?.routes || [])
			.map((r) => r?.shortName || r?.code || (r?.id ? String(r.id).split('_').pop() : null))
			.filter(Boolean)
	);

	const displayedRouteNames = $derived(
		isExpanded ? routeNames : routeNames.slice(0, MAX_ROUTES_TO_SHOW)
	);

	const remainingRoutesCount = $derived(Math.max(0, routeNames.length - MAX_ROUTES_TO_SHOW));

	const routesLabelText = $derived(
		displayedRouteNames.length > 0
			? `${displayedRouteNames.join(', ')}${!isExpanded && remainingRoutesCount > 0 ? ' +' + remainingRoutesCount : ''}`
			: ''
	);

	const labelPosition = $derived(
		(() => {
			if (!stop?.direction) return 'bottom';
			const dir = stop.direction.toLowerCase();
			// If direction is south/southeast/southwest, position label to the side
			if (dir === 's' || dir === 'se' || dir === 'sw') {
				return 'side';
			}
			return 'bottom';
		})()
	);

	function toggleRoutesList(event) {
		event.preventDefault();
		event.stopPropagation();
		isExpanded = !isExpanded;
	}

	function handleRoutesLabelKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			event.stopPropagation();
			toggleRoutesList(event);
		}
	}

	$effect(() => {
		if (!showRoutesLabel) {
			isExpanded = false;
		}
	});
</script>

<div class="marker-container">
	<button
		class="custom-marker dark:border-[#5a2c2c] {isHighlighted ? 'highlight' : ''}"
		onclick={onClick}
	>
		<span class="bus-icon dark:text-white">
			<FontAwesomeIcon {icon} class=" text-black" />
			{#if stop.direction}
				<span class="direction-arrow {stop.direction.toLowerCase()} dark:text-white">
					<FontAwesomeIcon icon={faCaretUp} class="dark:text-white" />
				</span>
			{/if}
		</span>
	</button>

	{#if showRoutesLabel && routesLabelText}
		<div
			role="button"
			tabindex="0"
			class="routes-label {isExpanded ? 'expanded' : ''} position-{labelPosition}"
			onclick={toggleRoutesList}
			onkeydown={handleRoutesLabelKeydown}
			aria-expanded={isExpanded}
			aria-label={isExpanded ? 'Collapse route list' : `Show all ${routeNames.length} routes`}
		>
			<span class="label-text">{routesLabelText}</span>
			{#if remainingRoutesCount > 0 && !isExpanded}
				<span class="expand-indicator" title="Click to see all routes">⋯</span>
			{/if}
		</div>
	{/if}
</div>

<style lang="postcss">
	.marker-container {
		position: relative;
		display: inline-block;
		pointer-events: none;
	}

	.marker-container > * {
		pointer-events: auto;
	}

	.custom-marker {
		@apply h-8 w-8 rounded-md;
		@apply bg-white/80 dark:bg-neutral-200;
		@apply border-2 border-gray-400;
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;
	}

	.highlight {
		@apply scale-125 border-brand-accent drop-shadow-md;
	}

	.custom-marker:hover {
		cursor: pointer;
	}

	.bus-icon {
		font-size: 20px;
		color: #000;
	}

	.direction-arrow {
		position: absolute;
		font-size: 20px;
		color: #000;
	}

	.direction-arrow.n {
		top: -20px;
		left: 8px;
		transform: rotate(0deg);
	}
	.direction-arrow.ne {
		top: -18px;
		right: -10px;
		transform: rotate(45deg);
	}
	.direction-arrow.e {
		right: -13px;
		top: 0px;
		transform: rotate(90deg);
	}
	.direction-arrow.se {
		bottom: -17px;
		right: -10px;
		transform: rotate(135deg);
	}
	.direction-arrow.s {
		bottom: -20px;
		left: 8px;
		transform: rotate(180deg);
	}
	.direction-arrow.sw {
		bottom: -18px;
		left: -10px;
		transform: rotate(225deg);
	}
	.direction-arrow.w {
		left: -13px;
		top: 0px;
		transform: rotate(270deg);
	}
	.direction-arrow.nw {
		top: -17px;
		left: -10px;
		transform: rotate(315deg);
	}

	.routes-label {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		cursor: pointer;

		position: absolute;
		@apply whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium;
		background-color: rgba(255, 255, 255, 0.95);
		color: #1f2937;
		@apply border-4 border-gray-300 hover:border-brand focus:border-brand active:border-brand;
		@apply shadow-lg;
		@apply transition-colors duration-200 ease-in-out;
		pointer-events: auto;
		z-index: 10;
		max-width: 200px;
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		gap: 0.25rem;
		outline: none;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.routes-label:focus {
		outline: 2px solid;
		@apply outline-brand;
		outline-offset: 2px;
	}

	.routes-label.position-bottom {
		top: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
	}

	.routes-label.position-side {
		top: 50%;
		left: calc(100% + 6px);
		transform: translateY(-50%);
	}

	.routes-label:hover .expand-indicator {
		@apply text-brand;
	}

	.routes-label.expanded {
		@apply font-semibold;
		@apply border-4 border-brand-secondary dark:border-brand;
		@apply text-gray-800 dark:text-white;
		white-space: normal;
		max-width: 250px;
		flex-wrap: wrap;
		overflow: visible;
		line-height: 1.4;
	}

	.label-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		flex: 1 1 auto;
	}

	.routes-label.expanded .label-text {
		white-space: normal;
		overflow: visible;
	}

	.expand-indicator {
		@apply ml-1 text-sm font-bold text-gray-500 dark:text-gray-300;
		transition: color 0.2s ease;
		flex-shrink: 0;
	}
</style>
