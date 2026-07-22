<script>
	import { t } from 'svelte-i18n';
	import { msToLocalArrivalDepartureTimeString } from '$lib/dateTimeFormat';
	import RouteBadge from '$components/RouteBadge.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTowerBroadcast, faClock } from '@fortawesome/free-solid-svg-icons';
	let { arrivalDeparture, includeArrivalDepartureInStatusLabel = true, route = null } = $props();

	const MS_IN_MINS = 60000;

	let routeShortName = $derived(arrivalDeparture.routeShortName);
	let tripHeadsign = $derived(arrivalDeparture.tripHeadsign);
	let scheduledArrivalTime = $derived(arrivalDeparture.scheduledArrivalTime);
	let predictedArrivalTime = $derived(arrivalDeparture.predictedArrivalTime);
	let scheduledDepartureTime = $derived(arrivalDeparture.scheduledDepartureTime);
	let predictedDepartureTime = $derived(arrivalDeparture.predictedDepartureTime);
	let tripStatus = $derived(arrivalDeparture.tripStatus);
	let frequency = $derived(arrivalDeparture.frequency);
	let stopSequence = $derived(arrivalDeparture.stopSequence || 1); // Default to 1 if not provided

	function computeColor(scheduledMins, predictedMins, isPredicted) {
		// Each colored branch returns the 600 shade for light mode (passes WCAG AA
		// on white) paired with the 400 shade in dark mode (passes on gray-800).
		// The colored 500 shades fail 4.5:1 in both modes for normal-size status
		// text — the neutral gray-500/400 below is the exception (gray-500 ≈ 4.8:1
		// on white, gray-400 passes on gray-800), so it's safe here.
		if (!isPredicted) {
			// Scheduled (no real-time) arrivals read fully muted, per the mockup.
			// gray-500 passes WCAG AA on white; gray-400 passes on the dark gray-800 surface.
			return 'text-gray-500 dark:text-gray-400';
		}

		const delay = predictedMins - scheduledMins;
		if (delay > 0) {
			return 'text-violet-600 dark:text-violet-400';
		} else if (delay < -1) {
			return 'text-red-600 dark:text-red-400';
		} else {
			return 'text-green-600 dark:text-green-400';
		}
	}

	function computeArrivalInfo(now = Date.now()) {
		const nowMins = Math.floor(now / MS_IN_MINS);

		let scheduled, predicted, isArrival;

		// Determine if this is the first stop in sequence (show departure) or not (show arrival)
		if (stopSequence !== 0) {
			scheduled = scheduledArrivalTime;
			predicted = predictedArrivalTime;
			isArrival = true;
		} else {
			scheduled = scheduledDepartureTime;
			predicted = predictedDepartureTime;
			isArrival = false;
		}

		const scheduledMins = scheduled ? Math.floor(scheduled / MS_IN_MINS) : 0;
		const predictedMins = predicted ? Math.floor(predicted / MS_IN_MINS) : 0;

		// eta is "estimated time of arrival" in minutes:
		// - Positive number: Bus arrives/departs in X minutes from now (e.g., eta = 5 means "5 minutes from now")
		// - Negative number: Bus already arrived/departed X minutes ago (e.g., eta = -3 means "3 minutes ago")
		// - Zero: Bus is arriving/departing right now
		// reference: Android App - ArrivalInfo.java
		let eta, displayTime, isPredicted;

		if (arrivalDeparture.predicted && predicted > 0) {
			isPredicted = true;
			eta = predictedMins - nowMins;
			displayTime = predicted;
		} else {
			isPredicted = false;
			eta = scheduledMins - nowMins;
			displayTime = scheduled;
		}

		const color = computeColor(scheduledMins, predictedMins, isPredicted);
		const statusText = computeStatusLabel(
			now,
			predicted,
			scheduledMins,
			predictedMins,
			isArrival,
			eta
		);
		const timeText = computeTimeLabel(eta, isPredicted, displayTime, scheduledMins, predictedMins);

		return {
			eta,
			displayTime,
			isPredicted,
			color,
			statusText,
			timeText,
			isArrival
		};
	}

	function computeStatusLabel(now, predictedTime, scheduledMins, predictedMins, isArrival, eta) {
		// CANCELED trips
		if (tripStatus && tripStatus.status === 'CANCELED') {
			if (!includeArrivalDepartureInStatusLabel) {
				return $t('status.canceled');
			}
			return isArrival ? $t('status.canceled_arrival') : $t('status.canceled_departure');
		}

		// Frequency (exact_times=0) trips
		if (frequency) {
			const headwayAsMinutes = Math.floor(frequency.headway / 60);
			const formatter = new Intl.DateTimeFormat([], {
				hour: '2-digit',
				minute: '2-digit'
			});

			if (now < frequency.startTime) {
				const label = formatter.format(new Date(frequency.startTime));
				return $t('status.frequency_from', {
					headway: headwayAsMinutes,
					time: label
				});
			} else {
				const label = formatter.format(new Date(frequency.endTime));
				return $t('status.frequency_until', {
					headway: headwayAsMinutes,
					time: label
				});
			}
		}

		if (predictedTime && predictedTime > 0) {
			const delay = predictedMins - scheduledMins;

			if (eta >= 0) {
				// Bus hasn't yet arrived/departed
				return computeArrivalLabelFromDelay(delay);
			} else {
				// Arrival/departure time has passed
				if (!includeArrivalDepartureInStatusLabel) {
					if (delay > 0) {
						return $t('status.late_without_arrive_depart', {
							values: { delay: Math.floor(Math.abs(delay)) }
						});
					} else if (delay < 0) {
						return $t('status.early_without_arrive_depart', {
							values: { delay: Math.floor(Math.abs(delay)) }
						});
					} else {
						return $t('status.on_time');
					}
				}

				if (isArrival) {
					// Is an arrival time
					if (delay > 0) {
						return $t('status.arrived_delayed', { values: { delay: Math.floor(Math.abs(delay)) } });
					} else if (delay < 0) {
						return $t('status.arrived_early', { values: { delay: Math.floor(Math.abs(delay)) } });
					} else {
						return $t('status.arrived_ontime');
					}
				} else {
					// Is a departure time
					if (delay > 0) {
						return $t('status.depart_delayed', { values: { delay: Math.floor(Math.abs(delay)) } });
					} else if (delay < 0) {
						return $t('status.depart_early', { values: { delay: Math.floor(Math.abs(delay)) } });
					} else {
						return $t('status.departed_ontime');
					}
				}
			}
		} else {
			// Scheduled times
			if (!includeArrivalDepartureInStatusLabel) {
				return $t('status.scheduled');
			}
			return isArrival ? $t('status.scheduled_arrival') : $t('status.scheduled_departure');
		}
	}

	function computeArrivalLabelFromDelay(delay) {
		if (delay > 0) {
			return $t('status.late_without_arrive_depart', {
				values: { delay: Math.floor(Math.abs(delay)) }
			});
		} else if (delay < 0) {
			return $t('status.early_without_arrive_depart', {
				values: { delay: Math.floor(Math.abs(delay)) }
			});
		} else {
			return $t('status.on_time');
		}
	}

	function computeTimeLabel(eta) {
		if (eta === 0) {
			return $t('time.now');
		}
		// Compact minute form (e.g. "19m", "1m", "-3m"). Unit is localizable.
		return $t('time.min_compact', { values: { n: eta } });
	}

	let currentTime = $state(Date.now());

	$effect(() => {
		const interval = setInterval(() => {
			currentTime = Date.now();
		}, 30000);

		return () => clearInterval(interval);
	});

	let arrivalInfo = $derived(computeArrivalInfo(currentTime));
</script>

<div class="flex w-full min-w-0 items-center gap-3 pr-1">
	<RouteBadge shortName={routeShortName} color={route?.color} textColor={route?.textColor} />

	<div class="min-w-0 flex-1">
		<p class="line-clamp-2 text-lg font-semibold text-gray-900 dark:text-white">
			{tripHeadsign}
		</p>
		<p class="truncate text-sm">
			<span class="text-gray-500 dark:text-gray-400"
				>{msToLocalArrivalDepartureTimeString(arrivalInfo.displayTime)} ·</span
			>
			<span class={arrivalInfo.color}>{arrivalInfo.statusText}</span>
		</p>
	</div>

	<div class="flex shrink-0 items-start gap-0.5">
		<span class="text-xl font-bold leading-none {arrivalInfo.color}">{arrivalInfo.timeText}</span>
		<FontAwesomeIcon
			icon={arrivalInfo.isPredicted ? faTowerBroadcast : faClock}
			class="text-xs {arrivalInfo.color}"
		/>
	</div>
</div>
