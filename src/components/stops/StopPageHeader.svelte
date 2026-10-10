<script lang="ts">
	import { ArrowLeft, Map, MapPin } from '@lucide/svelte';
	import CompassArrow from '$components/controls/CompassArrow.svelte';
	import FavoriteToggle from '$components/favorites/FavoriteToggle.svelte';
	import TabContainer from '$components/tabs/TabContainer.svelte';
	import TabLink from '$components/tabs/TabLink.svelte';
	import { page } from '$app/stores';
	import { t, isLoading } from 'svelte-i18n';
	import { removeAgencyPrefix, directionLabel } from '$lib/utils';

	interface Props {
		stopCode?: string | null;
		stopDirection?: string;
		stopId: string;
		stopLat: number;
		stopLon: number;
		stopName: string;
	}

	let { stopCode = null, stopDirection, stopId, stopLat, stopLon, stopName }: Props = $props();
</script>

<div class="my-4">
	<div class="mb-4 flex justify-start">
		<a
			href="/"
			class="inline-flex items-center gap-2 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-brand-accent-dark focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:outline-hidden"
		>
			<ArrowLeft class="rotate-rtl h-4 w-4" />
			<Map class="h-4 w-4" />
			{$isLoading ? '' : $t('navigation.back_to_map')}
		</a>
	</div>

	<div class="text-center">
		<div class="flex items-center justify-center gap-2">
			<h1 class="text-3xl font-bold text-brand-accent">
				{stopName}
			</h1>
			<FavoriteToggle
				type="stop"
				id={stopId}
				name={stopName}
				code={stopCode}
				direction={stopDirection}
				lat={stopLat}
				lon={stopLon}
				class="h-9 w-9"
			/>
		</div>
		<div class="text-normal mt-2 flex items-center justify-center gap-x-4 text-gray-700">
			<div class="flex items-center gap-x-1 rounded-full bg-gray-100 px-2.5 py-1">
				<MapPin class="inline h-4 w-4" />
				<strong>{$isLoading ? '' : $t('schedule_for_stop.stop_id')}:</strong>
				{removeAgencyPrefix(stopId)}
			</div>
			<div class="flex items-center gap-x-1 rounded-full bg-gray-100 px-2.5 py-1">
				<CompassArrow {stopDirection} />
				<strong>{$isLoading ? '' : $t('schedule_for_stop.direction')}:</strong>
				{#if stopDirection}
					{directionLabel(stopDirection, $t)}
				{:else}
					<span class="text-gray-600">
						{$isLoading ? '' : $t('schedule_for_stop.no_direction')}
					</span>
				{/if}
			</div>
		</div>
		<TabContainer>
			<TabLink
				href="/stops/{encodeURIComponent(stopId)}"
				current={$page.route.id === '/stops/[stopID]'}
				>{$isLoading ? '' : $t('arrivals_and_departures_for_stop.title')}</TabLink
			>
			<TabLink
				href="/stops/{encodeURIComponent(stopId)}/schedule"
				current={$page.route.id === '/stops/[stopID]/schedule'}
				>{$isLoading ? '' : $t('schedule_for_stop.route_schedules')}</TabLink
			>
		</TabContainer>
	</div>
</div>
