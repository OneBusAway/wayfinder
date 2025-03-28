<script>
	import ModalPane from '$components/navigation/ModalPane.svelte';
	import StopPane from '$components/stops/StopPane.svelte';

	let { handleUpdateRouteMap, tripSelected, stop, closePane } = $props();
	let previouslyFocusedElement = null;

	function trapFocus(event) {
		const focusableElements = event.target.querySelectorAll(
			'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
		);
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (event.shiftKey) {
			if (document.activeElement === firstElement) {
				lastElement.focus();
				event.preventDefault();
			}
		} else {
			if (document.activeElement === lastElement) {
				firstElement.focus();
				event.preventDefault();
			}
		}
	}

	function handleModalOpen() {
		previouslyFocusedElement = document.activeElement;
		const modalElement = document.querySelector('.modal-pane');
		modalElement.addEventListener('keydown', trapFocus);
		modalElement.focus();
	}

	function handleModalClose() {
		const modalElement = document.querySelector('.modal-pane');
		modalElement.removeEventListener('keydown', trapFocus);
		if (previouslyFocusedElement) {
			previouslyFocusedElement.focus();
		}
	}
</script>

<ModalPane
	{closePane}
	title={stop.name}
	on:open={handleModalOpen}
	on:close={handleModalClose}
	aria-labelledby="stop-modal-title"
	aria-describedby="stop-modal-description"
>
	<StopPane {tripSelected} {handleUpdateRouteMap} {stop} />
</ModalPane>
