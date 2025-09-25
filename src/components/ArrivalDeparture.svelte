<script>
	import { t } from 'svelte-i18n';
	let { arrivalDeparture, includeArrivalDepartureInStatusLabel = true } = $props();

	const MS_IN_MINS = 60000;

	let routeShortName = arrivalDeparture.routeShortName;
	let tripHeadsign = arrivalDeparture.tripHeadsign;
	let scheduledArrivalTime = arrivalDeparture.scheduledArrivalTime;
	let predictedArrivalTime = arrivalDeparture.predictedArrivalTime;
	let scheduledDepartureTime = arrivalDeparture.scheduledDepartureTime;
	let predictedDepartureTime = arrivalDeparture.predictedDepartureTime;
	let tripStatus = arrivalDeparture.tripStatus;
	let frequency = arrivalDeparture.frequency;
	let stopSequence = arrivalDeparture.stopSequence || 1; // Default to 1 if not provided

	function formatTime(time) {
		if (!time) return 'N/A';
		const date = new Date(time);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function computeColor(scheduledMins, predictedMins, isPredicted) {
		// If this is a scheduled (non-real-time) arrival, always show in blue
		if (!isPredicted) {
			return 'text-blue-500';
		}

		const delay = predictedMins - scheduledMins;
		if (delay > 0) {
			return 'text-violet-600';
		} else if (delay < -1) {
			return 'text-red-500';
		} else {
			return 'text-green-500';
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
		if (eta < 0) {
			return `${eta} ${$t('time.min')}`;
		} else if (eta === 0) {
			return $t('time.now');
		} else if (eta === 1) {
			return `1 ${$t('time.min')}`;
		} else {
			return `${eta} ${$t('time.mins')}`;
		}
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

<div class="flex flex-col gap-1">
	<p class="text-left text-xl font-semibold text-black dark:text-white">
		{routeShortName} - {tripHeadsign}
	</p>
	<p class="text-left font-semibold text-black dark:text-white">
		<span class="text-md">{formatTime(arrivalInfo.displayTime)}</span> -
		<span class={arrivalInfo.color}>
			{arrivalInfo.statusText}
		</span>
	</p>
</div>
<div>
	<p class="text-lg font-semibold {arrivalInfo.color}">
		{arrivalInfo.timeText}
	</p>
</div>
