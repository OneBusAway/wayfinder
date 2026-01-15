<script>
	import { formatTime } from '$lib/formatters';
	import { slide } from 'svelte/transition';
	import {
		faWalking,
		faBus,
		faTrain,
		faChevronDown,
		faChevronUp,
		faFerry,
		faTrainSubway,
		faRulerCombined,
		faClock,
		faArrowRight,
		faArrowAltCircleRight,
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { t } from 'svelte-i18n';

	let { leg, index, expandedSteps, toggleSteps, isLast = false } = $props();

	let isWalking = leg.mode === 'WALK';

	// Get icon and colors based on transport mode
	function getModeConfig(mode) {
		switch (mode) {
			case 'WALK':
				return {
					icon: faWalking,
					iconColor: 'text-blue-600',
					bgColor: 'bg-blue-100 dark:bg-blue-900/50'
				};
			case 'BUS':
				return {
					icon: faBus,
					iconColor: 'text-brand-accent',
					bgColor: 'bg-green-100 dark:bg-green-900/50'
				};
			case 'TRAIN':
			case 'RAIL':
				return {
					icon: faTrain,
					iconColor: 'text-red-600',
					bgColor: 'bg-red-100 dark:bg-red-900/50'
				};
			case 'FERRY':
				return {
					icon: faFerry,
					iconColor: 'text-cyan-600',
					bgColor: 'bg-cyan-100 dark:bg-cyan-900/50'
				};
			case 'LIGHT_RAIL':
				return {
					icon: faTrainSubway,
					iconColor: 'text-purple-600',
					bgColor: 'bg-purple-100 dark:bg-purple-900/50'
				};
			case 'TRAM':
				return {
					icon: faTrainSubway,
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
</script>

<div class="relative flex items-start {isLast ? 'pb-2' : 'pb-6'}">
	<!-- Timeline line -->
	{#if !isLast}
		<div
			class="absolute left-[23px] top-12 h-[calc(100%-40px)] w-0.5 {isWalking
				? 'border-l-2 border-dashed border-gray-300 dark:border-gray-600'
				: 'bg-brand'}"
		></div>
	{/if}

	<!-- Icon circle -->
	<div
		class="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full shadow-md ring-4 ring-white dark:ring-gray-900 {modeConfig.bgColor}"
	>
		{#if modeConfig.icon}
			<FontAwesomeIcon icon={modeConfig.icon} class="{modeConfig.iconColor} text-lg" />
		{/if}
	</div>

	<!-- Content -->
	<div class="ml-4 flex-1 pt-1">
		<!-- Header: Location name + route badge -->
		<div class="flex flex-wrap items-center gap-2">
			<span class="font-semibold text-gray-900 dark:text-white">{leg.from.name}</span>
			{#if !isWalking && leg.routeShortName}
				<span
					class="inline-flex items-center rounded-full bg-brand-accent px-2.5 py-0.5 text-xs font-bold text-white shadow-sm"
				>
					{leg.routeShortName}
				</span>
			{/if}
		</div>

		<!-- Times -->
		<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
			<div class="flex items-center text-gray-600 dark:text-gray-300">
				<FontAwesomeIcon icon={faClock} class="mr-1.5 h-3 w-3 text-blue-500" />
				<span>{$t('trip-planner.start')}:</span>
				<span class="ml-1 font-semibold">{formatTime(leg.startTime)}</span>
			</div>
			<div class="flex items-center text-gray-600 dark:text-gray-300">
				<FontAwesomeIcon icon={faClock} class="mr-1.5 h-3 w-3 text-red-500" />
				<span>{$t('trip-planner.end')}:</span>
				<span class="ml-1 font-semibold">{formatTime(leg.endTime)}</span>
			</div>
		</div>

		<!-- Details -->
		<div class="mt-3 space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
			<div class="flex items-center">
				<FontAwesomeIcon icon={faArrowRight} class="mr-2 h-3 w-3 text-brand" />
				<span>{leg.to.name}</span>
			</div>
			<div class="flex items-center">
				<FontAwesomeIcon icon={faRulerCombined} class="mr-2 h-3 w-3 text-gray-400" />
				<span
					>{$t('trip-planner.distance')}
					{Math.round(leg.distance)}
					{$t('trip-planner.meters')}</span
				>
			</div>
			<div class="flex items-center">
				<FontAwesomeIcon icon={faClock} class="mr-2 h-3 w-3 text-gray-400" />
				<span
					>{$t('trip-planner.duration')}: {Math.round(leg.duration / 60)} {$t('time.minutes')}</span
				>
			</div>
		</div>

		<!-- Walking steps toggle -->
		{#if isWalking && leg.steps?.length > 0}
			<button
				class="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-brand-accent transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
				onclick={() => toggleSteps(index)}
			>
				<FontAwesomeIcon
					icon={expandedSteps[index] ? faChevronUp : faChevronDown}
					class="h-3 w-3 transition-transform duration-200"
				/>
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
								<span class="flex items-center gap-1">
									<FontAwesomeIcon icon={faRulerCombined} class="h-3 w-3" />
									{Math.round(step.distance)}
									{$t('trip-planner.meters')}
								</span>
								<span class="flex items-center gap-1">
									<FontAwesomeIcon icon={faArrowAltCircleRight} class="h-3 w-3" />
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
