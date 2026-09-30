<!--
    @component
    Detail for one on-demand service in a bottom sheet over the map: status and
    how to book, hours, where it goes. Highlights and frames the service's zone
    while open. Status re-evaluates at its next change instant (and when the tab
    becomes visible) without refetching.

    @prop {string} serviceId - combined service id
    @prop {Function} closePane - closes the sheet
    @prop {import('$lib/types').MapProvider | null} mapProvider
    @prop {('peek'|'half'|'full')} snap - Bindable sheet detent
-->
<script>
	import { onDestroy, untrack } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faX,
		faPhone,
		faClock,
		faArrowUpRightFromSquare,
		faCircleInfo
	} from '@fortawesome/free-solid-svg-icons';
	import { locale, t } from 'svelte-i18n';
	import BottomSheet from '$components/navigation/BottomSheet.svelte';
	import { keybinding } from '$lib/keybinding';
	import { panelFitPadding } from '$lib/mapFitPadding.js';
	import {
		fetchService,
		onDemandState,
		setHighlightedService
	} from '$lib/onDemand/onDemandState.svelte.js';
	import { contactBookingRule } from '$lib/onDemand/models.js';
	import { whereSummary, serviceBounds } from '$lib/onDemand/serviceDetails.js';
	import { evaluateAvailability, TIER } from '$lib/onDemand/availability.js';
	import { formatStatus, formatBookingLine, bookingTagKey } from '$lib/onDemand/copy.js';
	import { hoursRows } from '$lib/onDemand/hours.js';
	import { scheduleAt } from '$lib/onDemand/instants.js';

	let { serviceId, closePane, mapProvider = null, snap = $bindable('half') } = $props();

	/** @type {{ kind: 'loading' } | { kind: 'ready', service: any } | { kind: 'notFound' } | { kind: 'error' }} */
	let loadState = $state({ kind: 'loading' });
	let now = $state(Temporal.Now.instant());
	let sheetElement = $state(null);
	let retryCount = $state(0);

	$effect(() => {
		const id = serviceId;
		retryCount; // Retry re-runs this effect so every load shares its cancellation.
		let cancelled = false;
		// fetchService reads onDemandState.support; a support flip must not re-run the load.
		untrack(() => load(id, () => cancelled));
		return () => {
			cancelled = true;
		};
	});

	async function load(id, isCancelled) {
		loadState = { kind: 'loading' };
		setHighlightedService(null);
		const result = await fetchService(id, 'simplified');
		if (isCancelled()) return;
		if (!result) {
			if (onDemandState.support === 'unsupported') closePane();
			else loadState = { kind: 'error' };
			return;
		}
		if (result.notFound) {
			loadState = { kind: 'notFound' };
			return;
		}
		loadState = { kind: 'ready', service: result.service };
		setHighlightedService(result.service);
	}

	function frame(service, provider) {
		const bounds = serviceBounds(service);
		if (!bounds || !provider.fitToBounds) return;
		const padding = panelFitPadding(sheetElement?.getBoundingClientRect(), {
			width: window.innerWidth,
			height: window.innerHeight
		});
		provider.fitToBounds(bounds, { padding });
	}

	onDestroy(() => setHighlightedService(null));

	let service = $derived(loadState.kind === 'ready' ? loadState.service : null);

	// Frame once per service, whichever of the load and the map provider arrives last
	// (on a cold load the provider is still null when the service resolves).
	let framedServiceId = null;
	$effect(() => {
		const readyService = service;
		const provider = mapProvider;
		if (!readyService || !provider || readyService.id === framedServiceId) return;
		framedServiceId = readyService.id;
		untrack(() => frame(readyService, provider));
	});

	let availability = $derived(service ? evaluateAvailability(service, now) : null);
	let copyContext = $derived(
		availability?.timeZone
			? { t: $t, locale: $locale ?? 'en', timeZone: availability.timeZone, now }
			: null
	);
	let contact = $derived(service ? contactBookingRule(service) : null);
	let where = $derived(service ? whereSummary(service) : null);
	let hours = $derived(
		service
			? hoursRows(service, {
					locale: $locale ?? 'en',
					today: availability?.today ?? Temporal.Now.plainDateISO()
				})
			: []
	);
	let showStatusLine = $derived(
		availability &&
			(availability.tier === TIER.OPEN_NOW ||
				availability.tier === TIER.SAME_DAY ||
				(availability.tier === TIER.UNKNOWN && availability.status.kind === 'closed'))
	);
	let statusLine = $derived(
		showStatusLine && copyContext ? formatStatus(availability.status, copyContext, 'detail') : null
	);
	let deadlineLine = $derived(
		availability?.tier === TIER.ADVANCE && copyContext
			? formatBookingLine(availability.resolution, copyContext)
			: null
	);
	let bookingLine = $derived(
		availability && copyContext
			? formatBookingLine(availability.resolution, copyContext)
			: $t('ondemand.booking_unknown')
	);
	let tagKey = $derived(availability ? bookingTagKey(availability.bookingTier) : null);
	let moreInfoUrl = $derived(
		contact?.infoUrl && contact.infoUrl !== service?.url ? contact.infoUrl : null
	);
	let messages = $derived(
		[contact?.message, contact?.pickupMessage, contact?.dropOffMessage].filter(Boolean)
	);

	$effect(() =>
		scheduleAt(availability?.nextChangeInstant ?? null, () => (now = Temporal.Now.instant()))
	);

	$effect(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible') now = Temporal.Now.instant();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	function hoursText(row) {
		if (row.kind === 'allHours') return $t('ondemand.all_service_hours');
		if (row.kind === 'noService') return $t('ondemand.no_service');
		const suffix = (nextDay) => (nextDay ? ` ${$t('ondemand.next_day')}` : '');
		return `${row.start}${suffix(row.startNextDay)} – ${row.end}${suffix(row.endNextDay)}`;
	}
</script>

<BottomSheet bind:snap bind:element={sheetElement}>
	{#snippet header()}
		<div class="-mx-3.5 border-b border-gray-200 px-3.5 pb-3 dark:border-gray-700">
			<div class="flex items-start gap-2.5">
				<h2 class="min-w-0 flex-1 text-xl font-bold text-black dark:text-white">
					{service?.name ?? ''}
				</h2>
				<button
					type="button"
					onclick={closePane}
					use:keybinding={{ code: 'Escape' }}
					aria-label={$t('ondemand.close')}
					class="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gray-200 text-sm text-black hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
				>
					<FontAwesomeIcon icon={faX} />
				</button>
			</div>
		</div>
	{/snippet}

	<div class="space-y-5 py-3">
		{#if loadState.kind === 'notFound'}
			<p class="text-sm text-gray-600 dark:text-gray-400">{$t('ondemand.not_available')}</p>
		{:else if loadState.kind === 'error'}
			<div class="flex flex-col items-start gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-400">{$t('ondemand.load_failed')}</p>
				<button
					type="button"
					onclick={() => (retryCount += 1)}
					class="rounded-lg bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand"
				>
					{$t('ondemand.retry')}
				</button>
			</div>
		{:else if service}
			<section class="space-y-2">
				{#if tagKey}
					<span
						class="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900 dark:bg-green-900/40 dark:text-green-100"
					>
						{$t(tagKey)}
					</span>
				{/if}
				{#if service.description}
					<p class="text-sm text-gray-700 dark:text-gray-300">{service.description}</p>
				{/if}
				{#if statusLine}
					<p
						data-testid="ondemand-status"
						class="text-sm font-medium text-gray-900 dark:text-white"
					>
						{statusLine}
					</p>
				{/if}
				{#if contact?.phoneNumber}
					<a
						href={`tel:${contact.phoneNumber}`}
						class="inline-flex h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-white hover:bg-brand"
					>
						<FontAwesomeIcon icon={faPhone} />
						{$t('ondemand.call', { values: { phone: contact.phoneNumber } })}
					</a>
				{:else if contact?.bookingUrl}
					<a
						href={contact.bookingUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-white hover:bg-brand"
					>
						{$t('ondemand.book_online')}
					</a>
				{/if}
			</section>

			{#if deadlineLine}
				<p
					data-testid="ondemand-deadline"
					class="flex items-start gap-2 text-sm text-gray-900 dark:text-white"
				>
					<FontAwesomeIcon icon={faClock} class="mt-0.5" />
					<span>{deadlineLine}</span>
				</p>
			{/if}

			{#if where?.show}
				<section>
					<h3 class="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
						{$t('ondemand.where')}
					</h3>
					<dl class="space-y-1 text-sm">
						<div>
							<dt class="font-medium text-gray-900 dark:text-white">
								{$t('ondemand.service_area')}
							</dt>
							<dd class="text-gray-600 dark:text-gray-400">
								{where.serviceAreaNames.length
									? where.serviceAreaNames.join(', ')
									: $t('ondemand.zone_count', { values: { count: where.serviceAreaCount } })}
							</dd>
						</div>
						{#if where.dropOffNames?.length}
							<div>
								<dt class="font-medium text-gray-900 dark:text-white">{$t('ondemand.drop_off')}</dt>
								<dd class="text-gray-600 dark:text-gray-400">{where.dropOffNames.join(', ')}</dd>
							</div>
						{/if}
					</dl>
				</section>
			{/if}

			{#if hours.length}
				<section>
					<h3 class="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
						{$t('ondemand.when')}
					</h3>
					<dl class="space-y-1 text-sm">
						{#each hours as row, index (index)}
							<div
								class="flex justify-between gap-4"
								class:text-gray-500={row.kind === 'noService'}
							>
								<dt>{row.days}</dt>
								<dd>{hoursText(row)}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/if}

			<section class="space-y-2 text-sm">
				<h3 class="font-semibold text-gray-900 dark:text-white">{$t('ondemand.how_to_book')}</h3>
				<p class="flex items-start gap-2 text-gray-700 dark:text-gray-300">
					<FontAwesomeIcon icon={faClock} class="mt-0.5" />
					<span>{bookingLine}</span>
				</p>
				{#if service.url}
					<a
						href={service.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 text-brand-accent hover:underline"
					>
						<FontAwesomeIcon icon={faArrowUpRightFromSquare} />
						{$t('ondemand.open_agency_website')}
					</a>
				{/if}
				{#if moreInfoUrl}
					<a
						href={moreInfoUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 text-brand-accent hover:underline"
					>
						<FontAwesomeIcon icon={faCircleInfo} />
						{$t('ondemand.more_information')}
					</a>
				{/if}
			</section>

			{#if messages.length}
				<footer class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
					{#each messages as message, index (index)}
						<p>{message}</p>
					{/each}
				</footer>
			{/if}
		{/if}
	</div>
</BottomSheet>
