<!--
    @component
    On-demand services available at a stop. Fetches each of the stop's
    onDemandServiceIds once per id set (the arrivals poll re-renders the stop
    every 30 s without refetching). A service that fails to load is left out;
    the card never shows an error because the arrivals are the page.

    @prop {Object} stop - OBA stop; reads stop.onDemandServiceIds
    @prop {(id: string) => void} [onSelectService] - opens the service in place (map sheet); links navigate otherwise
    @prop {Array} services - Bindable; the services that loaded
-->
<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPhone } from '@fortawesome/free-solid-svg-icons';
	import { locale, t } from 'svelte-i18n';
	import { fetchService, onDemandState } from '$lib/onDemand/onDemandState.svelte.js';
	import { contactBookingRule, onDemandServiceIds } from '$lib/onDemand/models.js';
	import { evaluateAvailability, sortByAvailability } from '$lib/onDemand/availability.js';
	import { formatStatus } from '$lib/onDemand/copy.js';
	import { minInstant, scheduleAt } from '$lib/onDemand/instants.js';
	import { onDemandServicePath } from '$lib/urls.js';

	let { stop, onSelectService = null, services = $bindable([]) } = $props();

	let now = $state(Temporal.Now.instant());
	let idsKey = $derived([...onDemandServiceIds(stop)].sort().join('|'));
	let isSupported = $derived(onDemandState.support !== 'unsupported');

	$effect(() => {
		const key = idsKey;
		if (!key || !isSupported) {
			services = [];
			return;
		}
		let cancelled = false;
		Promise.all(key.split('|').map((id) => fetchService(id, 'none'))).then((results) => {
			if (cancelled) return;
			services = results.filter((result) => result?.service).map((result) => result.service);
		});
		return () => {
			cancelled = true;
		};
	});

	let rows = $derived(
		sortByAvailability(
			services.map((service) => ({ service, availability: evaluateAvailability(service, now) })),
			$locale ?? undefined
		)
	);

	$effect(() => {
		const next = minInstant(rows.map((row) => row.availability.nextChangeInstant));
		return scheduleAt(next, () => (now = Temporal.Now.instant()));
	});

	function statusLine(availability) {
		if (!availability.timeZone) return null;
		const ctx = { t: $t, locale: $locale ?? 'en', timeZone: availability.timeZone, now };
		return formatStatus(availability.status, ctx, 'row');
	}

	function select(event, id) {
		if (!onSelectService) return;
		event.preventDefault();
		onSelectService(id);
	}
</script>

{#if isSupported && rows.length}
	<section class="mb-4 rounded-lg bg-white p-4 dark:bg-gray-800">
		<h3 class="mb-1 font-medium text-gray-700 dark:text-white">
			{$t('ondemand.card_title')}
		</h3>
		<ul class="divide-y divide-gray-200 dark:divide-gray-700">
			{#each rows as { service, availability } (service.id)}
				{@const phone = contactBookingRule(service)?.phoneNumber}
				{@const status = statusLine(availability)}
				<li class="flex items-center gap-3 py-2">
					<a
						href={onDemandServicePath(service.id)}
						onclick={(event) => select(event, service.id)}
						class="min-w-0 flex-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
					>
						<span class="block truncate font-medium text-gray-900 dark:text-white"
							>{service.name}</span
						>
						{#if status}
							<span class="block text-sm text-gray-600 dark:text-gray-400">{status}</span>
						{/if}
					</a>
					{#if phone}
						<a
							href={`tel:${phone}`}
							aria-label={$t('ondemand.call', { values: { phone } })}
							class="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-accent text-white hover:bg-brand"
						>
							<FontAwesomeIcon icon={faPhone} />
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
