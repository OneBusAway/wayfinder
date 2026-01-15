<script>
	import { fly } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { tripOptions, walkDistanceOptions } from '$stores/tripOptionsStore';

	let { onClose, onDone } = $props();

	// Local state for editing (copy from store)
	let departureType = $state($tripOptions.departureType);
	let departureTime = $state($tripOptions.departureTime || '');
	let departureDate = $state($tripOptions.departureDate || '');
	let wheelchair = $state($tripOptions.wheelchair);
	let optimize = $state($tripOptions.optimize);
	let maxWalkDistance = $state($tripOptions.maxWalkDistance);

	// Get today's date in YYYY-MM-DD format for date input
	// Uses local date components to avoid UTC timezone issues
	function getTodayDate() {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	// Get current time in HH:MM format for time input
	function getCurrentTime() {
		const now = new Date();
		return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	}

	function handleCancel() {
		onClose();
	}

	function handleDone() {
		// Update session values
		tripOptions.setSession('departureType', departureType);
		tripOptions.setSession('departureTime', departureType !== 'now' ? departureTime : null);
		tripOptions.setSession('departureDate', departureType !== 'now' ? departureDate : null);

		// Update persisted values
		tripOptions.setPersisted('wheelchair', wheelchair);
		tripOptions.setPersisted('optimize', optimize);
		tripOptions.setPersisted('maxWalkDistance', maxWalkDistance);

		onDone();
	}

	function selectDepartureType(type) {
		departureType = type;
		// Set default time/date when switching from 'now'
		if (type !== 'now' && !departureTime) {
			departureTime = getCurrentTime();
			departureDate = getTodayDate();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
	onclick={handleCancel}
	onkeydown={(e) => e.key === 'Escape' && handleCancel()}
	role="dialog"
	aria-modal="true"
	aria-labelledby="modal-title"
	tabindex="-1"
>
	<!-- Modal -->
	<div
		class="w-full max-w-md rounded-t-2xl bg-white dark:bg-gray-900 sm:rounded-2xl"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="document"
		transition:fly={{ y: 200, duration: 300 }}
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700"
		>
			<button
				type="button"
				onclick={handleCancel}
				class="text-base font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
			>
				{$t('trip-planner.cancel')}
			</button>
			<h2 id="modal-title" class="text-base font-semibold text-gray-900 dark:text-white">
				{$t('trip-planner.trip_options')}
			</h2>
			<button
				type="button"
				onclick={handleDone}
				class="text-base font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
			>
				{$t('trip-planner.done')}
			</button>
		</div>

		<!-- Content -->
		<div class="max-h-[70vh] overflow-y-auto p-4">
			<!-- Departure Time Section -->
			<div class="mb-6">
				<h3
					class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
				>
					{$t('trip-planner.departure_time')}
				</h3>
				<div class="overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
					<!-- Leave Now -->
					<button
						type="button"
						class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-200 dark:hover:bg-gray-700"
						onclick={() => selectDepartureType('now')}
					>
						<div class="flex items-center gap-3">
							<span class="text-lg">🕐</span>
							<div>
								<div class="font-medium text-gray-900 dark:text-white">
									{$t('trip-planner.leave_now')}
								</div>
							</div>
						</div>
						{#if departureType === 'now'}
							<span class="text-blue-600 dark:text-blue-400">✓</span>
						{/if}
					</button>

					<div class="mx-4 border-t border-gray-200 dark:border-gray-700"></div>

					<!-- Depart At -->
					<button
						type="button"
						class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-200 dark:hover:bg-gray-700"
						onclick={() => selectDepartureType('departAt')}
					>
						<div class="flex items-center gap-3">
							<span class="text-lg">🚀</span>
							<div>
								<div class="font-medium text-gray-900 dark:text-white">
									{$t('trip-planner.depart_at')}
								</div>
							</div>
						</div>
						{#if departureType === 'departAt'}
							<span class="text-blue-600 dark:text-blue-400">✓</span>
						{/if}
					</button>

					<div class="mx-4 border-t border-gray-200 dark:border-gray-700"></div>

					<!-- Arrive By -->
					<button
						type="button"
						class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-200 dark:hover:bg-gray-700"
						onclick={() => selectDepartureType('arriveBy')}
					>
						<div class="flex items-center gap-3">
							<span class="text-lg">🏁</span>
							<div>
								<div class="font-medium text-gray-900 dark:text-white">
									{$t('trip-planner.arrive_by')}
								</div>
							</div>
						</div>
						{#if departureType === 'arriveBy'}
							<span class="text-blue-600 dark:text-blue-400">✓</span>
						{/if}
					</button>
				</div>

				<!-- Time/Date Picker (shown when not "Leave Now") -->
				{#if departureType !== 'now'}
					<div class="mt-3 flex gap-2">
						<input
							type="time"
							bind:value={departureTime}
							class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
						/>
						<input
							type="date"
							bind:value={departureDate}
							min={getTodayDate()}
							class="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
						/>
					</div>
				{/if}
			</div>

			<!-- Wheelchair Accessible Section -->
			<div class="mb-6">
				<div class="overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
					<div class="flex items-center justify-between px-4 py-3">
						<div class="flex items-center gap-3">
							<span class="text-lg">♿</span>
							<div class="font-medium text-gray-900 dark:text-white">
								{$t('trip-planner.wheelchair_accessible')}
							</div>
						</div>
						<!-- Toggle Switch -->
						<button
							type="button"
							role="switch"
							aria-checked={wheelchair}
							aria-label={$t('trip-planner.wheelchair_accessible')}
							onclick={() => (wheelchair = !wheelchair)}
							class="relative h-7 w-12 rounded-full transition-colors duration-200 {wheelchair
								? 'bg-blue-600'
								: 'bg-gray-300 dark:bg-gray-600'}"
						>
							<span
								class="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 {wheelchair
									? 'translate-x-5'
									: 'translate-x-0'}"
							></span>
						</button>
					</div>
				</div>
				<p class="mt-2 px-1 text-xs text-gray-500 dark:text-gray-400">
					{$t('trip-planner.wheelchair_desc')}
				</p>
			</div>

			<!-- Route Optimization Section -->
			<div class="mb-6">
				<h3
					class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
				>
					{$t('trip-planner.route_optimization')}
				</h3>
				<div class="overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
					<!-- Fastest Trip -->
					<button
						type="button"
						class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-200 dark:hover:bg-gray-700"
						onclick={() => (optimize = 'fastest')}
					>
						<div class="flex items-center gap-3">
							<span class="text-lg">⏱️</span>
							<div>
								<div class="font-medium text-gray-900 dark:text-white">
									{$t('trip-planner.fastest_trip')}
								</div>
							</div>
						</div>
						{#if optimize === 'fastest'}
							<span class="text-blue-600 dark:text-blue-400">✓</span>
						{/if}
					</button>

					<div class="mx-4 border-t border-gray-200 dark:border-gray-700"></div>

					<!-- Fewest Transfers -->
					<button
						type="button"
						class="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-200 dark:hover:bg-gray-700"
						onclick={() => (optimize = 'fewestTransfers')}
					>
						<div class="flex items-center gap-3">
							<span class="text-lg">🔄</span>
							<div>
								<div class="font-medium text-gray-900 dark:text-white">
									{$t('trip-planner.fewest_transfers')}
								</div>
							</div>
						</div>
						{#if optimize === 'fewestTransfers'}
							<span class="text-blue-600 dark:text-blue-400">✓</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Walking Distance Section -->
			<div class="mb-2">
				<h3
					class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
				>
					{$t('trip-planner.walking_distance')}
				</h3>
				<div class="overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
					<div class="flex items-center justify-between px-4 py-3">
						<div class="flex items-center gap-3">
							<span class="text-lg">🚶</span>
							<div class="font-medium text-gray-900 dark:text-white">
								{$t('trip-planner.max_walking_distance')}
							</div>
						</div>
						<select
							bind:value={maxWalkDistance}
							class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						>
							{#each walkDistanceOptions as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
