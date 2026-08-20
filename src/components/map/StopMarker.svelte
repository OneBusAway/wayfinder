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
	 * @property {'full'|'routeDot'|'muted'} [emphasis] - Marker prominence,
	 *   decided by the map layer from the current selection. `full` is today's pin.
	 * @property {string|null} [dotColor] - Ring color for the `routeDot` tier.
	 */

	/** @type {Props} */
	let {
		stop,
		onClick,
		icon,
		isHighlighted = false,
		showRoutesLabel = false,
		emphasis = 'full',
		dotColor = null
	} = $props();

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

	// The selected stop is always among the stops served by the drawn routes, so
	// `emphasis: 'routeDot'` and `isHighlighted` collide by construction. Highlight
	// wins: the stop the rider picked must never be the quietest thing on screen.
	const resolvedEmphasis = $derived(isHighlighted ? 'full' : emphasis);
	const isFullPin = $derived(resolvedEmphasis === 'full');

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
	<!-- The button keeps its 32px box in every tier. Collapsing the *icon* to a
	     dot is the whole point, but collapsing the hit target with it would put
	     the control under the WCAG 2.5.8 minimum and make it unusable on touch. -->
	<button class="marker-hit-area h-8 w-8" onclick={onClick} aria-label={stop.name}>
		{#if isFullPin}
			<span class="custom-marker dark:border-[#5a2c2c] {isHighlighted ? 'highlight' : ''}">
				<span class="bus-icon dark:text-white">
					<FontAwesomeIcon {icon} class=" text-black" />
					{#if stop.direction}
						<span class="direction-arrow {stop.direction.toLowerCase()} dark:text-white">
							<FontAwesomeIcon icon={faCaretUp} />
						</span>
					{/if}
				</span>
			</span>
		{:else if resolvedEmphasis === 'routeDot'}
			<span class="emphasis-dot route-dot" style={dotColor ? `border-color: ${dotColor};` : ''}
			></span>
		{:else if resolvedEmphasis === 'muted'}
			<span class="emphasis-dot muted-dot"></span>
		{/if}
	</button>

	{#if isFullPin && showRoutesLabel && routesLabelText}
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
	@reference '../../app.css';

	.marker-container {
		position: relative;
		display: inline-block;
		pointer-events: none;
	}

	.marker-container > * {
		pointer-events: auto;
	}

	.marker-hit-area {
		display: flex;
		justify-content: center;
		align-items: center;
		background: none;
		border: none;
		padding: 0;
		position: relative;
	}

	.marker-hit-area:hover {
		cursor: pointer;
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

	.emphasis-dot {
		border-radius: 50%;
		display: block;
		flex: none;
	}

	/* "Beads on a string" along the drawn route: reads as a stop on a line the
	   rider cares about, without competing with the line itself. */
	.route-dot {
		height: 14px;
		width: 14px;
		background: #fff;
		border-width: 2.5px;
		border-style: solid;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.28);
	}

	/* Present for spatial context, but recedes. The white halo keeps it legible on
	   a dark basemap without adding visual weight. */
	.muted-dot {
		height: 9px;
		width: 9px;
		background: #8b93a1;
		opacity: 0.6;
		box-shadow: 0 0 0 2px rgb(255 255 255 / 0.65);
	}

	.highlight {
		@apply scale-125 border-brand-accent drop-shadow-md;
	}

	/* The caret is otherwise hard-coded black; tint it to match the selected
	   marker's brand-accent border. The caret's <svg> must stay classless (no
	   dark:text-white of its own) so it inherits color from this span instead
	   of shadowing it — see StopMarker.test.js for the regression this guards. */
	.highlight .direction-arrow {
		@apply text-brand-accent;
	}

	:global(.dark) .highlight .direction-arrow {
		@apply text-brand;
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
		@apply text-xs font-semibold;
		color: #1f2937;
		/* Map-label halo (like iOS): outline the text against the map instead
		   of drawing a bubble behind it. */
		--halo-color: rgba(255, 255, 255, 0.95);
		text-shadow:
			0 0 3px var(--halo-color),
			0 0 3px var(--halo-color),
			0 1px 2px var(--halo-color),
			0 -1px 2px var(--halo-color),
			1px 0 2px var(--halo-color),
			-1px 0 2px var(--halo-color);
		pointer-events: auto;
		z-index: 10;
		/* Absolutely-positioned inside the ~32px marker container, so without an
		   explicit width the label shrink-wraps to the container's width and
		   wraps after nearly every token. */
		width: max-content;
		max-width: 140px;
		text-align: center;
		white-space: normal;
		line-height: 1.3;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		outline: none;
	}

	:global(.dark) .routes-label {
		color: #fff;
		--halo-color: rgba(0, 0, 0, 0.9);
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

	.routes-label.expanded {
		max-width: 220px;
	}

	.expand-indicator {
		@apply text-sm font-bold;
		transition: color 0.2s ease;
		flex-shrink: 0;
	}

	.routes-label:hover .expand-indicator,
	.routes-label:hover .label-text {
		@apply text-brand;
	}
</style>
