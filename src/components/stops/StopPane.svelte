<script>
	import ArrivalDeparture from '$components/ArrivalDeparture.svelte';
	import TripDetailsPane from '$components/oba/TripDetailsPane.svelte';
	import Accordion from '$components/containers/SingleSelectAccordion.svelte';
	import AccordionItem from '$components/containers/AccordionItem.svelte';
	import SurveyModal from '$components/surveys/SurveyModal.svelte';
	import ServiceAlerts from '$components/service-alerts/ServiceAlerts.svelte';
	import { onDestroy, untrack } from 'svelte';
	import '$lib/i18n.js';
	import { isLoading, t } from 'svelte-i18n';
	import { submitHeroQuestion, skipSurvey } from '$lib/Surveys/surveyUtils';
	import { surveyStore, showSurveyModal, markSurveyAnswered } from '$stores/surveyStore';
	import { getUserId } from '$lib/utils/user';
	import SurveyBanner from '$components/surveys/SurveyBanner.svelte';
	import analytics from '$lib/Insights';
	import { filterActiveAlerts } from '$components/service-alerts/serviceAlertsHelper';
	import { removeAgencyPrefix, routeShortNamesForStop } from '$lib/utils';

	/**
	 * @typedef {Object} Props
	 * @property {any} stop
	 * @property {Function} [handleUpdateRouteMap]
	 * @property {Function} [tripSelected]
	 * @property {boolean} [showHeroCard] - Render the brand-accent hero card above the arrivals list
	 * @property {any} [arrivalsAndDeparturesResponse]
	 * @property {Map<string, any>} [routeColors]
	 */

	/** @type {Props} */
	let {
		stop,
		handleUpdateRouteMap = null,
		tripSelected = null,
		showHeroCard = true,
		arrivalsAndDeparturesResponse = $bindable(null),
		// Exposed so a parent (e.g. the bottom-sheet toolbar refresh button) can
		// reflect whether a fetch — initial, manual, or the 30s poll — is in flight.
		loading = $bindable(false),
		routeColors = null
	} = $props();

	// Time window (in minutes) for upcoming arrivals. Defaults to the OBA
	// default of 35; each "load more" click widens it, mirroring the Android
	// app's incrementMinutesAfter() behavior.
	const DEFAULT_MINUTES_AFTER = 35;
	const MINUTES_AFTER_INCREMENT = 30;

	// Seed from any server-rendered response so the standalone page shows arrivals
	// immediately instead of flashing the first-load skeleton.
	let arrivalsAndDepartures = $state(arrivalsAndDeparturesResponse?.data?.entry);
	let error = $state();
	// Seed alerts from the same server-rendered response so they show on first
	// render instead of waiting for the initial client fetch to complete.
	let serviceAlerts = $state(
		filterActiveAlerts(arrivalsAndDeparturesResponse?.data?.references?.situations ?? [])
	);
	let minutesAfter = $state(DEFAULT_MINUTES_AFTER);
	let loadingMore = $state(false);
	let noMoreArrivals = $state(false);

	let interval = null;
	let currentStopSurvey = $state(null);
	let remainingSurveyQuestions = $state([]);

	// Furthest arrival time (ms) observed when we last concluded "no more arrivals".
	// A later poll that surfaces an arrival beyond this clears the stale hint.
	let noMoreArrivalsBoundary = 0;

	let abortController = null;

	/**
	 * Returns the furthest-out arrival time (ms) in the list, preferring the
	 * predicted time and falling back to the scheduled time. Comparing this
	 * across window widenings is more robust than a raw count: an arrival
	 * departing the front of the list no longer masks a genuinely later one.
	 * @param {any[]} [arrivals]
	 * @returns {number}
	 */
	function furthestArrivalTime(arrivals) {
		let furthest = 0;
		for (const arrival of arrivals ?? []) {
			const time = arrival.predictedArrivalTime || arrival.scheduledArrivalTime || 0;
			if (time > furthest) furthest = time;
		}
		return furthest;
	}
	/**
	 * Fetches arrivals for the stop within the current `minutesAfter` window.
	 * @returns {Promise<number|null>} the number of arrivals fetched, or `null`
	 * when the request was aborted or failed (count is then unknown).
	 */
	async function loadData(stopID) {
		// Cancel the previous request if it exists
		if (abortController) {
			abortController.abort();
		}
		const controller = new AbortController();
		abortController = controller;

		loading = true;
		try {
			const response = await fetch(
				`/api/oba/arrivals-and-departures-for-stop/${stopID}?minutesAfter=${minutesAfter}`,
				{
					signal: controller.signal
				}
			);

			if (!response.ok) {
				throw new Error('Unable to fetch arrival/departure data');
			}

			const data = await response.json();
			arrivalsAndDeparturesResponse = data;
			arrivalsAndDepartures = data.data.entry;
			serviceAlerts = filterActiveAlerts(data.data.references.situations || []);
			error = null; // Clear previous errors if successful
			const count = arrivalsAndDepartures?.arrivalsAndDepartures?.length ?? 0;
			// Clear a stale "no more arrivals" hint only when a refresh actually
			// surfaces an arrival further out than the window we'd exhausted — a
			// poll returning the same (or nearer) arrivals must leave the hint up.
			if (
				noMoreArrivals &&
				furthestArrivalTime(arrivalsAndDepartures?.arrivalsAndDepartures) > noMoreArrivalsBoundary
			) {
				noMoreArrivals = false;
			}
			return count;
		} catch (err) {
			if (err.name !== 'AbortError') {
				error = 'Unable to fetch arrival/departure data';
			}
			return null;
		} finally {
			// Only the most recent request should control the loading flag.
			if (abortController === controller) {
				loading = false;
			}
		}
	}
	function resetDataFetchInterval(stopID) {
		if (interval) clearInterval(interval);

		const promise = loadData(stopID);

		interval = setInterval(() => {
			loadData(stopID);
		}, 30000);

		return promise;
	}

	// Manual refresh for the toolbar button: fetch now and restart the poll timer.
	export function refresh() {
		if (stop?.id) resetDataFetchInterval(stop.id);
	}

	// Widen the arrivals window and refetch. If the count doesn't grow, surface a
	// "no more arrivals found" hint (the server has nothing further to show).
	async function loadMoreArrivals() {
		const previousFurthest = furthestArrivalTime(arrivalsAndDepartures?.arrivalsAndDepartures);

		loadingMore = true;
		noMoreArrivals = false;
		minutesAfter += MINUTES_AFTER_INCREMENT;

		// Reset the poll timer so a background refresh doesn't abort this request
		// mid-flight (which would make us wrongly report "no more arrivals").
		const count = await resetDataFetchInterval(stop.id);

		loadingMore = false;
		// Only conclude "no more arrivals" from a request that actually completed.
		if (count !== null) {
			const newFurthest = furthestArrivalTime(arrivalsAndDepartures?.arrivalsAndDepartures);
			// Widening the window surfaced nothing further out → nothing more to show.
			noMoreArrivals = newFurthest <= previousFurthest;
			if (noMoreArrivals) noMoreArrivalsBoundary = newFurthest;
		}
		analytics.reportArrivalClicked('Loaded more arrivals');
	}

	$effect(() => {
		const stopID = stop?.id;
		if (!stopID) return;

		// Only re-run when the stop changes; reset the window for the new stop.
		untrack(() => {
			minutesAfter = DEFAULT_MINUTES_AFTER;
			noMoreArrivals = false;
			clearInterval(interval);
			resetDataFetchInterval(stopID);
		});
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
		// Abort any in-flight request so it can't mutate state after unmount.
		if (abortController) abortController.abort();
	});

	let routeShortNames = $derived(routeShortNamesForStop(arrivalsAndDeparturesResponse, stop));

	// references.routes carries the per-route color/textColor; the arrival objects
	// only carry routeId, so build a lookup to feed RouteBadge via ArrivalDeparture.
	let routeById = $derived(
		new Map((arrivalsAndDeparturesResponse?.data?.references?.routes ?? []).map((r) => [r.id, r]))
	);

	function handleAccordionSelectionChanged(event) {
		const data = event.activeData; // this is the ArrivalDeparture object plumbed into the AccordionItem
		const show = !!data;
		if (tripSelected) {
			tripSelected({ detail: data });
		}
		if (handleUpdateRouteMap) {
			handleUpdateRouteMap({ detail: { show } });
		}
		analytics.reportArrivalClicked('Clicked on arrival/departure');
	}

	let heroAnswer = '';
	let nextSurveyQuestion = $state(false);
	let surveyPublicIdentifier = $state(null);
	let showHeroQuestion = $state(true);

	function heroAnswerIsEmpty() {
		if (Array.isArray(heroAnswer)) return heroAnswer.length === 0;
		return !heroAnswer || heroAnswer.trim() === '';
	}

	async function handleSurveyButtonClick() {
		let heroQuestion = currentStopSurvey.questions[0];
		remainingSurveyQuestions = currentStopSurvey.questions.slice(1);

		if (heroQuestion.content.type !== 'label' && heroAnswerIsEmpty()) {
			return;
		}

		let surveyResponse = {
			survey_id: currentStopSurvey.id,
			user_identifier: getUserId(),
			stop_identifier: stop.id,
			stop_latitude: stop.lat,
			stop_longitude: stop.lon,
			responses: []
		};

		surveyResponse.responses[0] = {
			question_id: heroQuestion.id,
			question_label: heroQuestion.content.label_text,
			question_type: heroQuestion.content.type,
			answer: heroAnswer
		};

		try {
			surveyPublicIdentifier = await submitHeroQuestion(surveyResponse);
		} catch (error) {
			// Rethrow so SurveyBanner can show a retry affordance. The banner
			// stays mounted because showHeroQuestion is untouched.
			console.error('Error submitting hero question:', error);
			throw error;
		}

		// Only advance the flow once the hero answer is actually recorded.
		if (remainingSurveyQuestions.length > 0) {
			showSurveyModal.set(true);
		}
		nextSurveyQuestion = true;

		showHeroQuestion = false;
		markSurveyAnswered(currentStopSurvey.id);
	}

	function handleSkip() {
		skipSurvey(currentStopSurvey);
		showHeroQuestion = false;
	}

	// SurveyBanner resolves the answer (string, or string[] for checkboxes)
	// before reporting it, so this no longer digs into the DOM event.
	function handleHeroQuestionChange(answer) {
		heroAnswer = answer;
	}

	$effect(() => {
		currentStopSurvey = $surveyStore;
	});
</script>

{#snippet skeletonList()}
	<!-- First-load placeholder. Once real data arrives, `arrivalsAndDepartures`
	     stays set, so background refreshes never bring this back. -->
	<div class="space-y-4" role="status" aria-busy="true" aria-label={$t('loading')}>
		{#each Array.from({ length: 4 }, (_, i) => i) as i (i)}
			<div class="flex items-center gap-3 px-1">
				<div class="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"></div>
				<div class="flex-1 space-y-2">
					<div class="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="h-5 w-10 shrink-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
			</div>
		{/each}
	</div>
{/snippet}

{#if $isLoading}
	{@render skeletonList()}
{:else}
	<div>
		{#if error}
			<p>{error}</p>
		{/if}
		{#if arrivalsAndDepartures}
			<!-- No space-y here: the survey banner and the arrivals list must sit
			     flush against each other. Spacing is applied per-child instead. -->
			<div>
				{#if showHeroCard}
					<div class="mb-4">
						<div class="relative flex flex-col gap-y-1 rounded-lg bg-brand-accent p-4">
							<h1 class="h1 mb-0 text-white">{stop.name}</h1>
							<h2 class="h2 mb-0 text-white">
								{$isLoading ? '' : $t('stop')} #{removeAgencyPrefix(stop.id)}
							</h2>
							{#if routeShortNames && routeShortNames.length > 0}
								<h2 class="h2 mb-0 text-white">
									{$isLoading ? '' : $t('routes')}: {routeShortNames.join(', ')}
								</h2>
							{/if}

							{#if tripSelected}
								<div class="mt-auto flex justify-end gap-2">
									<a
										href={`/stops/${stop.id}`}
										class="inline-block rounded-lg border border-brand-accent bg-brand-accent px-3 py-1 text-sm font-medium text-white shadow-md transition duration-200 ease-in-out hover:bg-brand-accent-dark"
									>
										{$isLoading ? '' : $t('stop_details.view_details')}
									</a>
									<a
										href={`/stops/${stop.id}/schedule`}
										class="inline-block rounded-lg border border-brand-accent bg-brand-accent px-3 py-1 text-sm font-medium text-white shadow-md transition duration-200 ease-in-out hover:bg-brand-accent-dark"
									>
										{$isLoading ? '' : $t('schedule_for_stop.view_schedule')}
									</a>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if serviceAlerts?.length}
					<div class="mb-4">
						<ServiceAlerts bind:serviceAlerts stopId={stop.id} routeIds={stop.routeIds ?? []} />
					</div>
				{/if}

				{#if showHeroQuestion && currentStopSurvey}
					<!-- Keyed on the stop: StopBottomSheet is not remounted when the
					     user selects a different stop, so without this the previous
					     stop's expanded/answer state would carry over. -->
					{#key stop.id}
						<SurveyBanner
							{currentStopSurvey}
							{handleSkip}
							{handleSurveyButtonClick}
							{handleHeroQuestionChange}
							remainingQuestionsLength={(currentStopSurvey?.questions?.length ?? 1) - 1}
						/>
					{/key}
				{/if}
				{#if nextSurveyQuestion}
					<SurveyModal
						currentSurvey={currentStopSurvey}
						{stop}
						skipHeroQuestion={true}
						surveyPublicId={surveyPublicIdentifier}
					/>
				{/if}

				{#snippet loadMoreButton(emptyResults = false)}
					<div class="flex flex-col items-center gap-2">
						{#if emptyResults}
							<p class="text-sm text-gray-600 dark:text-gray-400">
								{$t('no_arrivals_found_in_next_minutes', { values: { minutes: minutesAfter } })}
							</p>
						{:else if noMoreArrivals}
							<p class="text-sm text-gray-600 dark:text-gray-400">
								{$t('no_more_arrivals_in_next_minutes', { values: { minutes: minutesAfter } })}
							</p>
						{/if}
						<button
							type="button"
							onclick={loadMoreArrivals}
							disabled={loadingMore}
							class="inline-flex items-center gap-2 rounded-lg border border-brand-accent bg-brand-accent px-4 py-2 text-sm font-medium text-white shadow-md transition duration-200 ease-in-out hover:bg-brand disabled:cursor-not-allowed disabled:opacity-60"
						>
							{loadingMore ? $t('loading') : $t('load_more_arrivals')}
						</button>
					</div>
				{/snippet}

				{#if arrivalsAndDepartures.arrivalsAndDepartures.length === 0}
					<div class="mt-4 flex flex-col items-center justify-center gap-3 first:mt-0">
						{@render loadMoreButton(true)}
					</div>
				{:else}
					{#key arrivalsAndDepartures.stopId}
						<Accordion {handleAccordionSelectionChanged}>
							{#each arrivalsAndDepartures.arrivalsAndDepartures as arrival}
								<AccordionItem data={arrival} fullBleed hideChevron>
									{#snippet header(isActive)}
										<!-- min-w-0 lets this flex child shrink below its content width so the
										     card's headsign wraps/clamps instead of pushing the ETA off-screen.
										     ArrivalDeparture renders the chevron itself (stacked under the ETA),
										     so the built-in AccordionItem chevron is hidden. -->
										<span class="block min-w-0 flex-1">
											<ArrivalDeparture
												arrivalDeparture={arrival}
												route={routeById.get(arrival.routeId)}
												routeColors={routeColors?.get(arrival.routeId) ?? null}
												expanded={isActive}
											/>
										</span>
									{/snippet}
									<TripDetailsPane
										{stop}
										tripId={arrival.tripId}
										serviceDate={arrival.serviceDate}
									/>
								</AccordionItem>
							{/each}
						</Accordion>
					{/key}
					<div class="mt-4 flex justify-center first:mt-0">
						{@render loadMoreButton()}
					</div>
				{/if}
			</div>
		{:else if !error}
			{@render skeletonList()}
		{/if}
	</div>
{/if}
