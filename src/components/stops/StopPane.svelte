<script>
	import ArrivalDeparture from '$components/ArrivalDeparture.svelte';
	import TripDetailsPane from '$components/oba/TripDetailsPane.svelte';
	import LoadingSpinner from '$components/LoadingSpinner.svelte';
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
	import HeroQuestion from '$components/surveys/HeroQuestion.svelte';
	import analytics from '$lib/Insights';
	import { filterActiveAlerts } from '$components/service-alerts/serviceAlertsHelper';
	import { removeAgencyPrefix } from '$lib/utils';

	/**
	 * @typedef {Object} Props
	 * @property {any} stop
	 * @property {any} [arrivalsAndDeparturesResponse]
	 */

	/** @type {Props} */
	let {
		stop,
		handleUpdateRouteMap = null,
		tripSelected = null,
		arrivalsAndDeparturesResponse = $bindable(null)
	} = $props();

	// Time window (in minutes) for upcoming arrivals. Defaults to the OBA
	// default of 35; each "load more" click widens it, mirroring the Android
	// app's incrementMinutesAfter() behavior.
	const DEFAULT_MINUTES_AFTER = 35;
	const MINUTES_AFTER_INCREMENT = 30;

	let arrivalsAndDepartures = $state();
	let loading = $state(false);
	let error = $state();
	let serviceAlerts = $state([]);
	let minutesAfter = $state(DEFAULT_MINUTES_AFTER);
	let loadingMore = $state(false);
	let noMoreArrivals = $state(false);

	let interval = null;
	let currentStopSurvey = $state(null);
	let remainingSurveyQuestions = $state([]);

	let abortController = null;
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
			return arrivalsAndDepartures?.arrivalsAndDepartures?.length ?? 0;
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

	// Widen the arrivals window and refetch. If the count doesn't grow, surface a
	// "no more arrivals found" hint (the server has nothing further to show).
	async function loadMoreArrivals() {
		const previousCount = arrivalsAndDepartures?.arrivalsAndDepartures?.length ?? 0;

		loadingMore = true;
		noMoreArrivals = false;
		minutesAfter += MINUTES_AFTER_INCREMENT;

		// Reset the poll timer so a background refresh doesn't abort this request
		// mid-flight (which would make us wrongly report "no more arrivals").
		const count = await resetDataFetchInterval(stop.id);

		loadingMore = false;
		// Only conclude "no more arrivals" from a request that actually completed.
		if (count !== null) {
			noMoreArrivals = count === previousCount;
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
	});

	let routeShortNames = $derived(
		arrivalsAndDeparturesResponse?.data?.references?.routes
			? arrivalsAndDeparturesResponse.data.references.routes
					.filter((r) => stop.routeIds.includes(r.id))
					// the route id will be always be required so if the shortName is missing, fall back to the id split and get the route id
					.map((r) => r.shortName || r.id.split('_')[1])
					.sort()
			: null
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

	async function handleSurveyButtonClick() {
		let heroQuestion = currentStopSurvey.questions[0];
		remainingSurveyQuestions = currentStopSurvey.questions.slice(1);
		if (heroQuestion.content.type !== 'label' && (!heroAnswer || heroAnswer.trim() === '')) {
			return;
		}

		// If there are more questions, show the modal
		if (remainingSurveyQuestions.length > 0) {
			showSurveyModal.set(true);
		}
		nextSurveyQuestion = true;

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

		surveyPublicIdentifier = await submitHeroQuestion(surveyResponse);
		showHeroQuestion = false;

		markSurveyAnswered(currentStopSurvey.id);
	}

	function handleSkip() {
		skipSurvey(currentStopSurvey);
		showHeroQuestion = false;
	}
	function handleHeroQuestionChange(event) {
		heroAnswer = event.target.value;
	}

	$effect(() => {
		currentStopSurvey = $surveyStore;
	});
</script>

{#if $isLoading}
	<p>Loading...</p>
{:else}
	<div>
		{#if loading && isLoading && tripSelected}
			<LoadingSpinner />
		{/if}

		{#if error}
			<p>{error}</p>
		{/if}
		{#if arrivalsAndDepartures}
			<div class="space-y-4">
				<div>
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

				{#if serviceAlerts}
					<ServiceAlerts bind:serviceAlerts />
				{/if}

				{#if showHeroQuestion && currentStopSurvey}
					<HeroQuestion
						{currentStopSurvey}
						{handleSkip}
						{handleSurveyButtonClick}
						{handleHeroQuestionChange}
						remainingQuestionsLength={remainingSurveyQuestions.length}
					/>
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
						{#if emptyResults || noMoreArrivals}
							<p class="text-sm text-gray-600 dark:text-gray-400">
								{$t('no_arrivals_found_in_next_minutes', { values: { minutes: minutesAfter } })}
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
					<div class="flex flex-col items-center justify-center gap-3">
						{@render loadMoreButton(true)}
					</div>
				{:else}
					{#key arrivalsAndDepartures.stopId}
						<Accordion {handleAccordionSelectionChanged}>
							{#each arrivalsAndDepartures.arrivalsAndDepartures as arrival}
								<AccordionItem data={arrival}>
									{#snippet header()}
										<span>
											<ArrivalDeparture arrivalDeparture={arrival} />
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
					<div class="flex justify-center">
						{@render loadMoreButton()}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
