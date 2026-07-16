<!--
    @component
    A draggable bottom sheet anchored to the bottom edge of its nearest positioned
    ancestor, with three snap points (peek / half / full). The map behind it stays
    visible and interactive; an optional non-interactive overlay dims the map when
    the sheet is at (or dragged near) the full snap point. Drag the handle row
    (including the header) to resize; arrow keys on the grab handle step between
    snap points.

    @prop {('peek'|'half'|'full')} snap - Bindable current snap point
    @prop {boolean} mapDim - Dim the map when the sheet is at (or dragged near) the full snap point
    @prop {import('svelte').Snippet} header - Condensed header rendered inside the drag-handle row
    @prop {import('svelte').Snippet} children - Scrollable sheet body
-->

<script>
	import '$lib/i18n.js';
	import { t } from 'svelte-i18n';

	let { snap = $bindable('half'), mapDim = true, header, children } = $props();

	const SNAP_ORDER = ['peek', 'half', 'full'];
	const PEEK_HEIGHT = 150;
	const HALF_FRACTION = 0.55;
	const MIN_DRAG_HEIGHT = 120;
	// Drag-height fraction of the container at which the dim engages (see `dimmed`)
	const DIM_THRESHOLD = 0.85;

	let containerHeight = $state(0);
	let dragOrigin = $state(null);
	let dragHeight = $state(null);

	let dragging = $derived(dragOrigin !== null);

	let snapHeights = $derived({
		peek: PEEK_HEIGHT,
		half: Math.round(containerHeight * HALF_FRACTION),
		full: containerHeight
	});

	let sheetHeight = $derived(dragHeight ?? snapHeights[snap]);
	// At rest the dim is tied to the full snap point; during a drag it tracks the
	// live height so it fades in/out as the sheet approaches full.
	let dimmed = $derived(
		mapDim &&
			(dragging
				? containerHeight > 0 && sheetHeight > containerHeight * DIM_THRESHOLD
				: snap === 'full')
	);

	function nearestSnap(height) {
		return SNAP_ORDER.reduce((closest, candidate) =>
			Math.abs(snapHeights[candidate] - height) < Math.abs(snapHeights[closest] - height)
				? candidate
				: closest
		);
	}

	function handlePointerDown(event) {
		// Let taps on the header's own controls (close, view details, ...) behave
		// as clicks; capturing the pointer here would swallow them.
		if (event.target.closest('a, button')) return;

		event.currentTarget.setPointerCapture?.(event.pointerId);
		dragOrigin = { y: event.clientY, height: sheetHeight };
	}

	function handlePointerMove(event) {
		if (!dragOrigin) return;
		const height = dragOrigin.height + (dragOrigin.y - event.clientY);
		dragHeight = Math.max(MIN_DRAG_HEIGHT, Math.min(containerHeight, height));
	}

	function handlePointerUp() {
		if (!dragOrigin) return;
		snap = nearestSnap(sheetHeight);
		dragOrigin = null;
		dragHeight = null;
	}

	function handleKeydown(event) {
		const index = SNAP_ORDER.indexOf(snap);
		let nextIndex = null;

		if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
			nextIndex = Math.min(index + 1, SNAP_ORDER.length - 1);
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
			nextIndex = Math.max(index - 1, 0);
		} else if (event.key === 'Home') {
			nextIndex = 0;
		} else if (event.key === 'End') {
			nextIndex = SNAP_ORDER.length - 1;
		}

		if (nextIndex !== null) {
			event.preventDefault();
			snap = SNAP_ORDER[nextIndex];
		}
	}
</script>

<div class="pointer-events-none absolute inset-0" bind:clientHeight={containerHeight}>
	<div
		class="absolute inset-0 transition-colors duration-[250ms] {dimmed
			? 'bg-gray-900/[.28]'
			: 'bg-transparent'}"
		data-testid="map-dim"
		aria-hidden="true"
	></div>

	<div
		class="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[14px] border border-b-0 border-gray-400 bg-surface/95 shadow-[0_-8px_24px_rgba(0,0,0,.18)] backdrop-blur dark:border-gray-600 dark:bg-surface-dark/95 dark:text-surface-foreground-dark"
		style:height="{sheetHeight}px"
		style:transition={dragging ? 'none' : 'height .28s cubic-bezier(0,0,.2,1)'}
		data-testid="bottom-sheet"
	>
		<div
			role="presentation"
			class="flex-none cursor-grab touch-none px-3.5 pb-1.5 pt-2"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
		>
			<div
				role="slider"
				tabindex="0"
				aria-label={$t('sheet.resize_handle')}
				aria-orientation="vertical"
				aria-valuemin="0"
				aria-valuemax={SNAP_ORDER.length - 1}
				aria-valuenow={SNAP_ORDER.indexOf(snap)}
				aria-valuetext={snap}
				onkeydown={handleKeydown}
				class="mx-auto mb-2 block h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600"
			></div>

			{@render header?.()}
		</div>

		<div
			class="flex-1 overflow-y-auto overscroll-contain px-3"
			style:padding-bottom="calc(1rem + env(safe-area-inset-bottom))"
		>
			{@render children?.()}
		</div>
	</div>
</div>
