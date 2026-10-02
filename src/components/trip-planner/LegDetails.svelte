<script>
	import { msToTimeString } from '$lib/dateTimeFormat';
	import { env } from '$env/dynamic/public';
	import { slide } from 'svelte/transition';
	import {
		ArrowLeft,
		ArrowRight,
		BusFront,
		ChevronDown,
		ChevronUp,
		CircleArrowRight,
		Clock,
		Footprints,
		Ruler,
		Ship,
		TrainFrontTunnel,
		TramFront
	} from '@lucide/svelte';
	import { t } from 'svelte-i18n';
	import { formatDistance } from '$lib/distanceUtils';
	import { effectiveDistanceUnit } from '$stores/tripOptionsStore';

	let {
		leg,
		index,
		expandedSteps,
		toggleSteps,
		isLast = false,
		isInterline = false,
		nextLegRouteName = ''
	} = $props();
	const regionTz = env.PUBLIC_OBA_TIMEZONE || undefined;
	let isWalking = $derived(leg.mode === 'WALK');

	// Route color properties (from OTP API)
	let hasRouteColor = $derived(!isWalking && !!leg.routeColor);
	let routeColorHex = $derived(hasRouteColor ? `#${leg.routeColor}` : null);
	let routeTextColorHex = $derived(leg.routeTextColor ? `#${leg.routeTextColor}` : '#ffffff');

	// Get icon and colors based on transport mode
	function getModeConfig(mode) {
		switch (mode) {
			case 'WALK':
				return {
					icon: Footprints,
					iconColor: 'text-blue-600',
					bgColor: 'bg-blue-100 dark:bg-blue-900/50'
				};
			case 'BUS':
				return {
					icon: BusFront,
					iconColor: 'text-brand-accent',
					bgColor: 'bg-green-100 dark:bg-green-900/50'
				};
			case 'TRAIN':
			case 'RAIL':
				return {
					icon: TramFront,
					iconColor: 'text-red-600',
					bgColor: 'bg-red-100 dark:bg-red-900/50'
				};
			case 'FERRY':
				return {
					icon: Ship,
					iconColor: 'text-cyan-600',
					bgColor: 'bg-cyan-100 dark:bg-cyan-900/50'
				};
			case 'LIGHT_RAIL':
				return {
					icon: TrainFrontTunnel,
					iconColor: 'text-purple-600',
					bgColor: 'bg-purple-100 dark:bg-purple-900/50'
				};
			case 'TRAM':
				return {
					icon: TramFront,
					iconColor: 'text-orange-600',
					bgColor: 'bg-orange-100 dark:bg-orange-900/50'
				};
			default:
				return {
					icon: null,
					iconColor: 'text-gray-600',
					bgColor: 'bg-gray-100 dark:bg-gray-800'
				};
		}
	}

	let modeConfig = $derived(getModeConfig(leg.mode));
	let ModeIcon = $derived(modeConfig.icon);

	// Computed style/class pairs to avoid template duplication
	let colorStyles = $derived.by(() => {
		if (hasRouteColor) {
			return {
				timelineClass: '',
				timelineStyle: `background-color: ${routeColorHex}`,
				iconClass: '',
				iconStyle: `background-color: ${routeColorHex}`,
				iconColor: routeTextColorHex,
				iconColorClass: '',
				badgeClass:
					'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm',
				badgeStyle: `background-color: ${routeColorHex}; color: ${routeTextColorHex}`
			};
		}
		return {
			timelineClass: isWalking
				? 'border-l-2 border-dashed border-gray-300 dark:border-gray-600'
				: 'bg-brand',
			timelineStyle: '',
			iconClass: modeConfig.bgColor,
			iconStyle: '',
			iconColor: '',
			iconColorClass: modeConfig.iconColor,
			badgeClass:
				'inline-flex items-center rounded-full bg-brand-accent px-2.5 py-0.5 text-xs font-bold text-white shadow-sm',
			badgeStyle: ''
		};
	});
</script>

<div class="relative flex items-start {isLast ? 'pb-2' : 'pb-6'}">
	<!-- Timeline line -->
	{#if !isLast}
		<div
			class="absolute left-[23px] top-12 h-[calc(100%-40px)] w-0.5 {colorStyles.timelineClass}"
			style={colorStyles.timelineStyle}
		></div>
	{/if}

	<!-- Icon circle -->
	<div
		class="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full shadow-md ring-4 ring-white dark:ring-gray-900 {colorStyles.iconClass}"
		style={colorStyles.iconStyle}
	>
		{#if ModeIcon}
			<ModeIcon
				class="{colorStyles.iconColorClass} h-5 w-5"
				style={colorStyles.iconColor ? `color: ${colorStyles.iconColor}` : ''}
			/>
		{/if}
	</div>

	<!-- Content -->
	<div class="ml-4 flex-1 pt-1">
		<!-- Header: Headsign + route badge -->
		<div class="flex flex-wrap items-center gap-2">
			{#if !isWalking && leg.routeShortName}
				<span class={colorStyles.badgeClass} style={colorStyles.badgeStyle}>
					{leg.routeShortName}
				</span>
			{/if}
			<span class="font-semibold text-gray-900 dark:text-white">{leg.headsign}</span>
		</div>

		<!-- Times -->
		<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
			<div class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
				<Clock class="h-3.5 w-3.5 shrink-0 text-blue-500" />
				<span>{$t('trip-planner.start')}:</span>
				<span class="ml-1 font-semibold">{msToTimeString(leg.startTime, regionTz)}</span>
			</div>
			<div class="flex items-center gap-2 text-gray-600 dark:text-gray-300">
				<Clock class="h-3.5 w-3.5 shrink-0 text-red-500" />
				<span>{$t('trip-planner.end')}:</span>
				<span class="ml-1 font-semibold">{msToTimeString(leg.endTime, regionTz)}</span>
			</div>
		</div>

		<!-- Details -->
		<div class="mt-3 space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
			<div class="flex items-center gap-2.5">
				<ArrowLeft class="rotate-rtl h-3.5 w-3.5 shrink-0 text-brand" />
				<span>{leg.from.name}</span>
			</div>

			<div class="flex items-center gap-2.5">
				<ArrowRight class="rotate-rtl h-3.5 w-3.5 shrink-0 text-brand" />
				<span>{leg.to.name}</span>
			</div>
			<div class="flex items-center gap-2.5">
				<Ruler class="h-3.5 w-3.5 shrink-0 text-gray-400" />
				<span
					>{$t('trip-planner.distance')}
					{formatDistance(leg.distance, $effectiveDistanceUnit, $t)}</span
				>
			</div>
			<div class="flex items-center gap-2.5">
				<Clock class="h-3.5 w-3.5 shrink-0 text-gray-400" />
				<span
					>{$t('trip-planner.duration')}: {Math.round(leg.duration / 60)} {$t('time.minutes')}</span
				>
			</div>
			{#if isInterline}
				<!-- Interline indicator -->
				<div class="flex items-center gap-2.5 text-sm text-amber-900 dark:text-amber-200">
					<CircleArrowRight class="rotate-rtl h-3.5 w-3.5 shrink-0 text-gray-400" />
					<span class="font-medium">
						{$t('trip-planner.stay_on_board', { values: { route: nextLegRouteName } })}
					</span>
				</div>
			{/if}
		</div>

		<!-- Walking steps toggle -->
		{#if isWalking && leg.steps?.length > 0}
			<button
				class="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-brand-accent transition-colors hover:bg-gray-100 dark:text-brand dark:hover:bg-gray-800"
				onclick={() => toggleSteps(index)}
			>
				{#if expandedSteps[index]}
					<ChevronUp class="h-3 w-3 transition-transform duration-200" />
				{:else}
					<ChevronDown class="h-3 w-3 transition-transform duration-200" />
				{/if}
				{expandedSteps[index] ? $t('trip-planner.hide_steps') : $t('trip-planner.show_steps')}
			</button>

			{#if expandedSteps[index]}
				<div
					class="mt-3 space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50"
					transition:slide={{ duration: 200 }}
				>
					{#each leg.steps as step}
						<div class="text-sm">
							<div class="font-medium text-gray-800 dark:text-gray-200">
								{step.relativeDirection} on {step.streetName}
							</div>
							<div class="mt-1 flex flex-wrap gap-x-4 text-gray-500 dark:text-gray-400">
								<span class="flex items-center gap-1.5">
									<Ruler class="h-3.5 w-3.5 shrink-0" />
									{formatDistance(step.distance, $effectiveDistanceUnit, $t)}
								</span>
								<span class="flex items-center gap-1.5">
									<CircleArrowRight class="rotate-rtl h-3.5 w-3.5 shrink-0" />
									{step.absoluteDirection}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
