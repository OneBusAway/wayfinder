<script>
	import { modalOpen } from '$src/stores/modalOpen';
	import {
		faChevronLeft,
		faChevronRight as faChevronRightPagination
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Modal } from 'flowbite-svelte';
	import ServiceAlertItem from './ServiceAlertItem.svelte';
	import { t } from 'svelte-i18n';
	import { env } from '$env/dynamic/public';
	import {
		orderAlertsByRelevance,
		activeWindowRange,
		normalizeSeverity
	} from '$components/service-alerts/serviceAlertsHelper';

	/**
	 * @typedef {Object} Props
	 * @property {any[]} [serviceAlerts]
	 * @property {string | null} [stopId]
	 * @property {string[]} [routeIds]
	 */

	/** @type {Props} */
	let { serviceAlerts = $bindable([]), stopId = null, routeIds = [] } = $props();

	let modalAlert = $state(null);
	let isAlertsHidden = $state(false);
	let currentPage = $state(1);
	const alertsPerPage = 3;

	const regionTz = env.PUBLIC_OBA_TIMEZONE || undefined;

	let relevance = $derived(orderAlertsByRelevance(serviceAlerts, { stopId, routeIds }));
	let orderedAlerts = $derived(relevance.ordered);
	let relevantCount = $derived(relevance.relevantCount);
	let showGroups = $derived(relevantCount > 0 && relevantCount < orderedAlerts.length);

	let totalPages = $derived(Math.ceil(orderedAlerts.length / alertsPerPage) || 1);
	let pageStart = $derived((currentPage - 1) * alertsPerPage);

	let paginatedAlerts = $derived(orderedAlerts.slice(pageStart, pageStart + alertsPerPage));

	let modalSeverity = $derived(modalAlert ? normalizeSeverity(modalAlert) : null);
	let modalWindow = $derived(modalAlert ? activeWindowRange(modalAlert) : null);
	let modalEffect = $derived(modalAlert?.consequences?.[0]?.condition ?? null);

	function formatAlertDate(ms) {
		if (!Number.isFinite(ms)) return null;
		return new Intl.DateTimeFormat(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZone: regionTz
		}).format(new Date(ms));
	}

	let modalActiveLabel = $derived.by(() => {
		if (!modalWindow) return null;
		const from = formatAlertDate(modalWindow.from);
		const to = modalWindow.to != null ? formatAlertDate(modalWindow.to) : null;
		if (from && to) {
			return $t('service_alerts.active_range', { values: { from, to } });
		}
		if (to) {
			return $t('service_alerts.active_until', { values: { date: to } });
		}
		if (from) {
			return $t('service_alerts.active_from', { values: { date: from } });
		}
		return null;
	});

	function reasonLabel(reason) {
		if (!reason) return null;
		const key = `service_alerts.reason_${reason}`;
		const translated = $t(key);
		return translated === key ? reason : translated;
	}

	function openModal(alert) {
		modalAlert = alert;
		modalOpen.set(true);
	}

	function closeModal() {
		modalOpen.set(false);
	}

	function toggleAlerts() {
		if (isAlertsHidden) {
			isAlertsHidden = false;
			currentPage = 1;
		} else {
			isAlertsHidden = true;
		}
	}

	function goToPage(page) {
		currentPage = Math.max(1, Math.min(page, totalPages));
		isAlertsHidden = false;
	}

	function handleKeydown(event) {
		if (!$modalOpen) return;
		if (event.key === 'Escape') {
			event.stopPropagation();
			event.preventDefault();
			closeModal();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if orderedAlerts.length > 0}
	<div class="relative flex flex-col gap-y-1 rounded-lg bg-white p-4 dark:bg-gray-800">
		<div class="mb-2 flex items-center justify-between">
			<h3 class="font-medium text-gray-700 dark:text-white">
				{$t('service_alerts.service_alerts')} ({orderedAlerts.length})
			</h3>
			<button
				type="button"
				class="text-sm font-medium text-brand-accent hover:text-brand focus:outline-none dark:text-brand dark:hover:text-white"
				onclick={toggleAlerts}
			>
				{isAlertsHidden ? $t('service_alerts.show') : $t('service_alerts.hide')}
			</button>
		</div>

		{#if !isAlertsHidden}
			<div class="space-y-2">
				{#each paginatedAlerts as alert, i}
					{@const absoluteIndex = pageStart + i}
					{#if showGroups && absoluteIndex === 0}
						<p
							class="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
						>
							{$t('service_alerts.affects_this_stop')}
						</p>
					{/if}
					{#if showGroups && absoluteIndex === relevantCount}
						<p
							class="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
						>
							{$t('service_alerts.other_alerts')}
						</p>
					{/if}
					<ServiceAlertItem {alert} {openModal} />
				{/each}
			</div>

			{#if totalPages > 1}
				<div class="mt-3 flex items-center justify-center gap-4">
					<button
						type="button"
						class="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
						onclick={() => goToPage(currentPage - 1)}
						disabled={currentPage === 1}
					>
						<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4" />
					</button>
					<span class="text-sm text-gray-700 dark:text-gray-300">
						{$t('service_alerts.page')}
						{currentPage} of {totalPages}
					</span>
					<button
						type="button"
						class="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
						onclick={() => goToPage(currentPage + 1)}
						disabled={currentPage === totalPages}
					>
						<FontAwesomeIcon icon={faChevronRightPagination} class="h-4 w-4" />
					</button>
				</div>
			{/if}
		{/if}
	</div>
{/if}

{#if $modalOpen && modalAlert}
	<Modal
		outsideclose={true}
		title={modalAlert?.summary?.value || $t('service_alerts.service_alert')}
		bind:open={$modalOpen}
		size="3xl"
		class="relative w-full max-w-3xl rounded-xl bg-white p-8 text-gray-900 shadow-2xl dark:bg-gray-800 dark:text-gray-100"
	>
		{#if modalSeverity}
			<span
				class="mb-3 inline-flex rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide
					{modalSeverity === 'severe'
					? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
					: modalSeverity === 'warning'
						? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
						: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'}"
			>
				{$t(`service_alerts.severity_${modalSeverity}`)}
			</span>
		{/if}
		{#if !modalAlert?.summary?.value}
			<p class="mb-3 italic text-gray-500 dark:text-gray-400">
				{$t('service_alerts.no_summary')}
			</p>
		{/if}
		{#if modalAlert?.description?.value}
			<p class="mt-3 text-base leading-relaxed text-gray-800 dark:text-gray-200">
				{modalAlert.description.value}
			</p>
		{:else}
			<p class="mt-3 italic text-gray-500 dark:text-gray-400">
				{$t('service_alerts.no_description')}
			</p>
		{/if}
		{#if modalActiveLabel || modalAlert?.reason || modalEffect}
			<dl class="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
				{#if modalActiveLabel}
					<div>
						<dt class="inline font-medium text-gray-500 dark:text-gray-400">
							{$t('service_alerts.active')}:
						</dt>
						<dd class="ml-1 inline">{modalActiveLabel}</dd>
					</div>
				{/if}
				{#if modalAlert?.reason}
					<div>
						<dt class="inline font-medium text-gray-500 dark:text-gray-400">
							{$t('service_alerts.cause')}:
						</dt>
						<dd class="ml-1 inline">
							{reasonLabel(modalAlert.reason)}
						</dd>
					</div>
				{/if}
				{#if modalEffect}
					<div>
						<dt class="inline font-medium text-gray-500 dark:text-gray-400">
							{$t('service_alerts.effect')}:
						</dt>
						<dd class="ml-1 inline">{modalEffect}</dd>
					</div>
				{/if}
			</dl>
		{/if}
		{#if modalAlert?.advice?.value}
			<div class="mt-4 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
				<p class="text-sm font-medium text-blue-800 dark:text-blue-200">
					{$t('service_alerts.advice')}: {modalAlert.advice.value}
				</p>
			</div>
		{/if}
	</Modal>
{/if}
