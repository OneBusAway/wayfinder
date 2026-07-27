<!--
    @component
    A draggable bottom sheet anchored to the bottom edge of its nearest positioned
    ancestor, with three snap points (peek / half / full). Content behind it stays
    visible and interactive. Drag the handle row (including the header) to resize;
    on the grab handle, arrow keys step between snap points and Home/End jump to
    the extremes.

    @prop {('peek'|'half'|'full')} snap - Bindable current snap point
    @prop {import('svelte').Snippet} header - Condensed header rendered inside the drag-handle row
    @prop {import('svelte').Snippet} children - Scrollable sheet body
-->

<script>
	import '$lib/i18n.js';
	import { t } from 'svelte-i18n';

	let { snap = $bindable('half'), header, children } = $props();

	const SNAP_ORDER = ['peek', 'half', 'full'];
	const PEEK_HEIGHT = 150;
	const HALF_FRACTION = 0.55;
	const MIN_DRAG_HEIGHT = 120;

	let containerHeight = $state(0);
	// One in-flight gesture: null when idle, { y, startHeight, height } while dragging.
	let drag = $state(null);

	let dragging = $derived(drag !== null);

	let snapHeights = $derived({
		peek: PEEK_HEIGHT,
		half: Math.round(containerHeight * HALF_FRACTION),
		full: containerHeight
	});

	let sheetHeight = $derived(drag?.height ?? snapHeights[snap]);

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
		drag = { y: event.clientY, startHeight: sheetHeight, height: sheetHeight };
	}

	function handlePointerMove(event) {
		if (!drag) return;
		const height = drag.startHeight + (drag.y - event.clientY);
		drag.height = Math.max(MIN_DRAG_HEIGHT, Math.min(containerHeight, height));
	}

	function handlePointerUp() {
		if (!drag) return;
		snap = nearestSnap(sheetHeight);
		drag = null;
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
				aria-valuetext={$t(`sheet.snap_${snap}`)}
				onkeydown={handleKeydown}
				class="mx-auto mb-2 block h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600"
			></div>

			{@render header?.()}
		</div>

		<!-- px-4 (not px-3) so full-bleed accordion rows, which reach the edge with
		     `-mx-4` (1rem), line up exactly with this padding instead of spilling 4px
		     past it. overflow-x-hidden guards against any other incidental overflow. -->
		<div
			class="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4"
			style:padding-bottom="calc(1rem + env(safe-area-inset-bottom))"
		>
			{@render children?.()}
		</div>
	</div>
</div>
