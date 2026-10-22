<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { CalendarClock, Clock, MapPin } from '@lucide/svelte';
	import { prioritizedRouteTypeForDisplay } from '$config/routeConfig';
	import { contrastRatio } from '$lib/colorUtils';
	import { formatLastUpdated } from '$lib/dateTimeFormat';
	import '$lib/i18n';
	import { t } from 'svelte-i18n';

	let {
		nextDestination,
		vehicleId,
		lastUpdateTime,
		nextStopName,
		predicted,
		routeShortName,
		routeColor,
		routeTextColor,
		routeType,
		scheduleDeviation,
		nextStopTimeOffset
	} = $props();

	const STALE_AFTER_MS = 2 * 60 * 1000;
	const CLOCK_TICK_MS = 10000;

	let currentTime = $state(Date.now());

	$effect(() => {
		const interval = setInterval(() => {
			currentTime = Date.now();
		}, CLOCK_TICK_MS);

		return () => clearInterval(interval);
	});

	const lastUpdatedText = $derived.by(() => {
		void currentTime;
		return formatLastUpdated(lastUpdateTime, {
			min: $t('time.min'),
			mins: $t('time.mins'),
			sec: $t('time.sec'),
			secs: $t('time.secs'),
			ago: $t('time.ago')
		});
	});

	const badgeBackground = $derived(routeColor ? `#${routeColor}` : '#374151');
	const badgeForeground = $derived.by(() => {
		if (routeTextColor) return `#${routeTextColor}`;
		return contrastRatio(badgeBackground, '#ffffff') >= contrastRatio(badgeBackground, '#000000')
			? '#ffffff'
			: '#000000';
	});
	const modeIcon = $derived(prioritizedRouteTypeForDisplay(routeType));

	const displayVehicleId = $derived(vehicleId ? String(vehicleId).replace(/^[^_]+_/, '') : null);

	const isStale = $derived(
		predicted && Number.isFinite(lastUpdateTime) && currentTime - lastUpdateTime > STALE_AFTER_MS
	);

	const deviation = $derived.by(() => {
		if (isStale || !Number.isFinite(scheduleDeviation)) return null;
		const minutes = Math.round(scheduleDeviation / 60);
		if (minutes === 0) return { text: $t('vehicle.on_time'), late: false };
		if (minutes > 0)
			return { text: $t('vehicle.min_late', { values: { n: minutes } }), late: true };
		return { text: $t('vehicle.min_early', { values: { n: -minutes } }), late: false };
	});

	const etaText = $derived.by(() => {
		if (isStale || !Number.isFinite(nextStopTimeOffset)) return null;
		if (nextStopTimeOffset <= 30) return $t('vehicle.arriving');
		const minutes = Math.round(nextStopTimeOffset / 60);
		return `${minutes} ${minutes === 1 ? $t('time.min') : $t('time.mins')}`;
	});
</script>

<div
	class="vehicle-popup-card w-72 max-w-full overflow-hidden rounded-xl bg-surface text-start text-surface-foreground dark:bg-surface-dark dark:text-surface-foreground-dark"
>
	<div class="flex flex-col gap-2.5 px-4 pt-3.5 pb-3">
		<div class="flex flex-wrap items-center gap-2.5 pe-7">
			{#if routeShortName}
				<span
					class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-bold"
					style="background-color: {badgeBackground}; color: {badgeForeground};"
				>
					<FontAwesomeIcon icon={modeIcon} class="h-3 w-3" />
					{routeShortName}
				</span>
			{/if}
			{#if isStale}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
				>
					<Clock class="h-3 w-3" aria-hidden="true" />
					{$t('vehicle.last_seen', { values: { time: lastUpdatedText } })}
				</span>
			{:else if predicted}
				<span
					class="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400"
				>
					<span class="relative flex h-2 w-2">
						<span
							class="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 motion-safe:animate-ping"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-current"></span>
					</span>
					{$t('vehicle.live')} · {lastUpdatedText}
				</span>
			{:else}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
				>
					<CalendarClock class="h-3 w-3" aria-hidden="true" />
					{$t('vehicle.scheduled')}
				</span>
			{/if}
		</div>

		{#if nextDestination}
			<div>
				<div class="text-xs font-medium text-gray-500 dark:text-gray-400">
					{$t('vehicle.towards')}
				</div>
				<div class="text-lg leading-tight font-bold">{nextDestination}</div>
			</div>
		{/if}

		{#if predicted}
			<div
				class="-mx-1 grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg bg-gray-100 px-3 py-2.5 dark:bg-gray-800"
			>
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-brand-accent dark:bg-surface-dark dark:text-brand"
				>
					<MapPin class="h-4 w-4" aria-hidden="true" />
				</span>
				<div class="min-w-0">
					<div
						class="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						{$t('vehicle.next_stop_label')}
					</div>
					<div class="truncate font-semibold">{nextStopName || $t('NA')}</div>
				</div>
				{#if etaText || deviation}
					<div class="text-end">
						{#if etaText}
							<div class="font-bold tabular-nums">{etaText}</div>
						{/if}
						{#if deviation}
							<div
								class="text-[11px] font-medium {deviation.late
									? 'text-amber-700 dark:text-amber-300'
									: 'text-green-700 dark:text-green-400'}"
							>
								{deviation.text}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<p class="text-sm text-gray-500 dark:text-gray-400">{$t('vehicle.no_real_time_data')}</p>
		{/if}
	</div>

	{#if displayVehicleId}
		<div
			class="border-t border-gray-200 px-4 py-2.5 font-mono text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
		>
			{$t('vehicle.id', { values: { id: displayVehicleId } })}
		</div>
	{/if}
</div>
