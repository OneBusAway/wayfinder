<script>
	import { faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import CompassArrow from '$components/controls/CompassArrow.svelte';
	import TabContainer from '$components/tabs/TabContainer.svelte';
	import TabLink from '$components/tabs/TabLink.svelte';
	import { page } from '$app/stores';

	import { t } from 'svelte-i18n';
	import { removeAgencyPrefix } from '$lib/utils';
	let { stopName, stopId, stopDirection } = $props();
</script>

<div class="my-4 text-center">
	<h1 class="flex items-center justify-center gap-2 text-3xl font-bold text-brand-secondary">
		{stopName}
	</h1>
	<div class="text-normal mt-2 flex items-center justify-center gap-x-8 text-gray-700">
		<div class="rounded-md bg-gray-50 px-2 py-1">
			<FontAwesomeIcon icon={faMapMarkerAlt} />
			<strong>{$t('schedule_for_stop.stop_id')}:</strong>
			{removeAgencyPrefix(stopId)}
		</div>
		<div class="rounded-md bg-gray-50 px-2 py-1">
			<CompassArrow {stopDirection} />
			<strong>{$t('schedule_for_stop.direction')}:</strong>
			{stopDirection}
		</div>
	</div>
	<TabContainer>
		<TabLink href="/stops/{stopId}" current={$page.route.id === '/stops/[stopID]'}
			>{$t('arrivals_and_departures_for_stop.title')}</TabLink
		>
		<TabLink href="/stops/{stopId}/schedule" current={$page.route.id === '/stops/[stopID]/schedule'}
			>{$t('schedule_for_stop.route_schedules')}</TabLink
		>
	</TabContainer>
</div>
