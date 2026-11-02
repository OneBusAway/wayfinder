<script lang="ts">
	import { ArrowLeft, Map } from '@lucide/svelte';
	import CompassArrow from '$components/controls/CompassArrow.svelte';
	import FavoriteToggle from '$components/favorites/FavoriteToggle.svelte';
	import RoutePill from '$components/map/RoutePill.svelte';
	import TabContainer from '$components/tabs/TabContainer.svelte';
	import TabLink from '$components/tabs/TabLink.svelte';
	import { page } from '$app/stores';
	import { t, isLoading } from 'svelte-i18n';
	import { removeAgencyPrefix, stopSubtitle } from '$lib/utils';

	interface RouteReference {
		id: string;
		shortName?: string;
		color?: string;
		textColor?: string;
		type?: number;
	}

	interface Props {
		routeIds?: string[];
		routes?: RouteReference[];
		stopCode?: string | null;
		stopDirection?: string;
		stopId: string;
		stopLat: number;
		stopLon: number;
		stopName: string;
	}

	let {
		routeIds = [],
		routes = [],
		stopCode = null,
		stopDirection,
		stopId,
		stopLat,
		stopLon,
		stopName
	}: Props = $props();

	// Only the routes that serve this stop, in natural order (2 before 10).
	const stopRoutes = $derived(
		routes
			.filter((route) => routeIds.includes(route.id))
			.sort((a, b) =>
				(a.shortName || a.id).localeCompare(b.shortName || b.id, undefined, { numeric: true })
			)
	);

	const subtitle = $derived(
		$isLoading ? '' : stopSubtitle({ id: stopId, code: stopCode, direction: stopDirection }, $t)
	);
</script>

<div class="my-4">
	<div class="mb-4 flex justify-start">
		<!-- FIXME: navigation path not built with resolve() -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href="/"
			class="inline-flex items-center gap-2 rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white shadow-xs transition-colors hover:bg-brand-accent-dark focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:outline-hidden"
		>
			<ArrowLeft class="rotate-rtl h-4 w-4" />
			<Map class="h-4 w-4" />
			{$isLoading ? '' : $t('navigation.back_to_map')}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>

	<div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
		<div class="flex items-start justify-between gap-3">
			<h1
				class="min-w-0 text-2xl font-bold break-words text-surface-foreground dark:text-surface-foreground-dark"
			>
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
				class="h-9 w-9 shrink-0"
			/>
		</div>

		{#if subtitle}
			<p class="mt-1 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
				<CompassArrow {stopDirection} />
				<span>{subtitle}</span>
			</p>
		{/if}

		{#if stopRoutes.length}
			<ul class="mt-3 flex flex-wrap gap-1.5" aria-label={$isLoading ? '' : $t('routes')}>
				{#each stopRoutes as route (route.id)}
					<li>
						<RoutePill
							shortName={route.shortName || removeAgencyPrefix(route.id)}
							color={route.color}
							textColor={route.textColor}
							routeType={route.type}
						/>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-4">
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
</div>
