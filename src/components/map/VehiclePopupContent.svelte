<script>
	export let routeName;
	export let vehicleId;
	export let lastUpdated;
	export let nextStopName;
	export let status;
</script>

<div style="font-family: Arial, sans-serif; font-size: 14px;">
	<div style="font-weight: bold;">{routeName}</div>
	<div>
		Vehicle #{vehicleId || 'N/A'} | Data updated {lastUpdated} seconds ago
	</div>
	<br />
	<div style="font-weight: bold;">Next stop:</div>
	<div style="padding-left: 20px;">
		<strong>{nextStopName || 'N/A'}</strong>
	</div>
	<br />
	<div style="font-weight: bold;">Status:</div>
	<div style="padding-left: 20px;">
		<strong>{status || 'N/A'}</strong>
	</div>
</div>
