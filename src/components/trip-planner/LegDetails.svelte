<script>
	import { formatTime } from '$lib/formatters';
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
		faTram
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { t } from 'svelte-i18n';
	let { leg, index, expandedSteps, toggleSteps } = $props();
	let icon = $state();
	let iconColor = $state();

	let isWalking = leg.mode === 'WALK';

	// TODO: Add more icons for different modes of transport
	switch (leg.mode) {
		case 'WALK':
			icon = faWalking;
			iconColor = 'text-blue-600';
			break;
		case 'BUS':
			icon = faBus;
			iconColor = 'text-brand-accent';
			break;
		case 'TRAIN':
			icon = faTrain;
			iconColor = 'text-red-600';
			break;
		case 'RAIL':
			icon = faTrain;
			iconColor = 'text-red-600';
			break;
		case 'FERRY':
			icon = faFerry;
			iconColor = 'text-blue-700';
			break;
		case 'LIGHT_RAIL':
			icon = faTrainSubway;
			iconColor = 'text-red-600';
			break;
		case 'TRAM':
			icon = faTram;
			iconColor = 'text-orange-500';
			break;
		default:
			icon = null;
	}
</script>

<div class="relative flex items-start pb-8">
	<div
		class="absolute left-5 top-5 border-l-4 border-brand {isWalking
			? 'border-dotted'
			: 'border-gray-300'} h-full"
	></div>
	<div
		class="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 shadow-md dark:bg-white"
	>
		{#if icon}
			<FontAwesomeIcon {icon} class={iconColor + ' text-xl'} />
		{/if}
	</div>

	<div class="ml-3 mt-3 flex-1">
		<div class="mb-2 flex items-center justify-between">
			<div class="text-md font-semibold text-gray-800 dark:text-white">{leg.from.name}</div>
		</div>

		<div class="mt-3 flex space-x-4 text-sm text-gray-600 dark:text-gray-100">
			<div class="flex items-center">
				<FontAwesomeIcon icon={faClock} class="mr-1 text-blue-500" />
				<span class="text-md">{$t('trip-planner.start')}:</span>
				<div class="ml-1 flex items-baseline">
					<span class="text-md font-semibold">{formatTime(leg.startTime).slice(0, -3)}</span>
					<span class="ml-1 text-xs">{formatTime(leg.startTime).slice(-2)}</span>
				</div>
			</div>
			<div class="flex items-center">
				<FontAwesomeIcon icon={faClock} class="mr-1 text-red-500" />
				<span class="text-md">{$t('trip-planner.end')}:</span>
				<div class="ml-1 flex items-baseline">
					<span class="text-md font-semibold">{formatTime(leg.endTime).slice(0, -3)}</span>
					<span class="ml-1 text-xs">{formatTime(leg.endTime).slice(-2)}</span>
				</div>
			</div>
		</div>

		<div class="mt-4 space-y-4 text-sm text-gray-600 dark:text-gray-100">
			<div class="mb-2 flex items-center">
				<FontAwesomeIcon icon={faArrowRight} class="mr-2 text-brand" />
				<span class="font-medium">{leg.to.name}</span>
			</div>
			<div class="mb-2 flex items-center">
				<FontAwesomeIcon icon={faRulerCombined} class="mr-2 text-gray-400" />
				<span>Distance: {Math.round(leg.distance)} {$t('trip-planner.meters')}</span>
			</div>
			<div class="mb-4 flex items-center">
				<FontAwesomeIcon icon={faClock} class="mr-2 text-gray-400" />
				<span
					>{$t('trip-planner.duration')}: {Math.round(leg.duration / 60)} {$t('time.minutes')}</span
				>
			</div>
		</div>

		{#if isWalking}
			<button class="mt-4 flex items-center text-blue-500" onclick={() => toggleSteps(index)}>
				<FontAwesomeIcon icon={expandedSteps[index] ? faChevronUp : faChevronDown} class="mr-2" />
				{expandedSteps[index] ? 'Hide Steps' : 'Show Steps'}
			</button>

			{#if expandedSteps[index]}
				<div class="mt-4 space-y-2">
					{#each leg.steps as step}
						<div class="text-sm">
							<div class="font-semibold">{step.relativeDirection} on {step.streetName}</div>
							<div class="mb-2 flex items-center">
								<FontAwesomeIcon icon={faRulerCombined} class="mr-2 text-gray-400" />
								<span
									>{$t('trip-planner.distance')}
									{Math.round(step.distance)}
									{$t('trip-planner.meters')}</span
								>
							</div>
							<div class="flex items-center">
								<FontAwesomeIcon icon={faArrowAltCircleRight} class="mr-2 text-gray-400" />
								<span>{step.absoluteDirection}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
