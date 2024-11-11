<script>
	import { formatTime } from '$lib/formatters';
	import {
		faWalking,
		faBus,
		faTrain,
		faChevronDown,
		faChevronUp,
		faFerry,
		faTrainSubway
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	export let leg;
	export let index;
	export let expandedSteps;
	export let toggleSteps;

	// TODO: ADD ICONS FOR OTHER MODES
	let icon;
	let modeText;
	let iconColor;
	switch (leg.mode) {
		case 'WALK':
			icon = faWalking;
			modeText = 'Walking';
			iconColor = 'text-blue-600';
			break;
		case 'BUS':
			icon = faBus;
			modeText = `Bus - ${leg.route}`;
			iconColor = 'text-green-600';
			break;
		case 'TRAIN':
			icon = faTrain;
			modeText = `Train - ${leg.route}`;
			iconColor = 'text-red-600';
			break;

		case 'RAIL':
			icon = faTrain;
			modeText = `Train - ${leg.route}`;
			iconColor = 'text-red-600';
			break;
		case 'FERRY':
			icon = faFerry;
			modeText = `Ferry - ${leg.route}`;
			iconColor = 'text-blue-700';
			break;
		case 'LIGHT_RAIL':
			icon = faTrainSubway;
			modeText = `Light Rail - ${leg.route}`;
			iconColor = 'text-red-600';
			break;
		default:
			icon = null;
			modeText = leg.mode;
	}
</script>

<div class="flex items-start space-x-4 border-b pb-4">
	<div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
		{#if icon}
			<FontAwesomeIcon {icon} class={iconColor} />
		{/if}
	</div>

	<div class="flex-1">
		<h4 class="text-md font-semibold">{modeText}</h4>
		<p>From: {leg.from.name}</p>
		<p>To: {leg.to.name}</p>
		<p>Distance: {Math.round(leg.distance)} meters</p>
		<p>Duration: {Math.round(leg.duration / 60)} minutes</p>
		<p>Start Time: {formatTime(leg.startTime)}</p>
		<p>End Time: {formatTime(leg.endTime)}</p>

		{#if leg.mode === 'WALK'}
			<button class="mt-2 flex items-center text-blue-500" on:click={() => toggleSteps(index)}>
				<FontAwesomeIcon icon={expandedSteps[index] ? faChevronUp : faChevronDown} class="mr-2" />
				{expandedSteps[index] ? 'Hide Steps' : 'Show Steps'}
			</button>

			{#if expandedSteps[index]}
				<div class="mt-2 space-y-2 pl-4">
					{#each leg.steps as step}
						<div class="text-sm">
							<p class="font-semibold">
								{step.relativeDirection} on {step.streetName}
							</p>
							<p>Distance: {Math.round(step.distance)} meters</p>
							<p>Direction: {step.absoluteDirection}</p>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
