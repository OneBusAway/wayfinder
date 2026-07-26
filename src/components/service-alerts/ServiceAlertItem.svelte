<script>
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCircleExclamation,
		faTriangleExclamation,
		faCircleInfo,
		faChevronRight
	} from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';
	import { env } from '$env/dynamic/public';
	import {
		normalizeSeverity,
		activeWindowRange
	} from '$components/service-alerts/serviceAlertsHelper';

	let { alert = $bindable({}), openModal } = $props();

	const regionTz = env.PUBLIC_OBA_TIMEZONE || undefined;

	const SEVERITY_UI = {
		severe: {
			icon: faTriangleExclamation,
			iconClass: 'text-red-600 dark:text-red-400',
			badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
		},
		warning: {
			icon: faCircleExclamation,
			iconClass: 'text-amber-600 dark:text-amber-400',
			badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
		},
		info: {
			icon: faCircleInfo,
			iconClass: 'text-blue-600 dark:text-blue-400',
			badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
		}
	};

	let severity = $derived(normalizeSeverity(alert));
	let severityUi = $derived(SEVERITY_UI[severity]);
	let severityLabel = $derived($t(`service_alerts.severity_${severity}`));
	let summaryText = $derived(
		alert?.summary?.value || alert?.description?.value || $t('service_alerts.service_alert')
	);
	let windowRange = $derived(activeWindowRange(alert));

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

	let activeLabel = $derived.by(() => {
		if (!windowRange) return null;
		const from = formatAlertDate(windowRange.from);
		const to = windowRange.to != null ? formatAlertDate(windowRange.to) : null;
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
</script>

<button
	type="button"
	class="flex w-full cursor-pointer items-start gap-3 rounded-lg p-1 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent dark:hover:bg-gray-700"
	aria-label={$t('service_alerts.open_alert', {
		values: {
			severity: severityLabel,
			summary: summaryText
		}
	})}
	onclick={() => openModal(alert)}
>
	<div class="mt-2 flex-shrink-0" aria-hidden="true">
		<FontAwesomeIcon
			icon={severityUi.icon}
			class={severityUi.iconClass}
			style="width: 1.4rem; height: 1.4rem;"
		/>
	</div>
	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-center gap-2">
			<span
				class="inline-flex rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide {severityUi.badgeClass}"
			>
				{severityLabel}
			</span>
			<h4 class="line-clamp-3 font-medium text-gray-900 dark:text-white">
				{summaryText}
			</h4>
		</div>
		{#if alert?.summary?.value && alert?.description?.value}
			<p class="mt-1 line-clamp-3 text-sm text-gray-500 dark:text-gray-300">
				{alert.description.value}
			</p>
		{/if}
		{#if activeLabel}
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{activeLabel}</p>
		{/if}
	</div>
	<div class="ml-2 flex-shrink-0 self-center" aria-hidden="true">
		<FontAwesomeIcon icon={faChevronRight} class="h-5 w-5 text-gray-400" />
	</div>
</button>
