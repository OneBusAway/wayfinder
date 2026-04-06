<!--
    @component
    A modal component that displays stop information using StopPane.

    @prop {boolean} showAllStops - Flag to control visibility of all stops
    @prop {Object} stop - Stop object containing stop details

    @fires {CustomEvent} close - Emitted when the modal is closed
    @fires {CustomEvent} tripSelected - Forwarded from StopPane when a trip is selected
    @fires {CustomEvent} updateRouteMap - Forwarded from StopPane when route map needs updating
    @fires {CustomEvent} showAllStops - Forwarded from StopPane when all stops should be shown
-->

<script>
	import ModalPane from '$components/navigation/ModalPane.svelte';
	import StopPane from '$components/stops/StopPane.svelte';

	let { handleUpdateRouteMap, tripSelected, stop, closePane } = $props();
</script>

<ModalPane {closePane} title={stop.name} favoriteId={stop.id} favoriteType="stop">
	<StopPane {tripSelected} {handleUpdateRouteMap} {stop} />
</ModalPane>
