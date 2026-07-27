# Stop UI Arrival/Departure Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the stop pane's arrivals/departures UI (route badge, headsign, colored `time · status` sub-line, large compact ETA with live/schedule icon, "ARRIVALS & DEPARTURES" section header, and a restyled trip-detail timeline) to match the provided mockup.

**Architecture:** Add a reusable `RouteBadge.svelte`. Redesign `ArrivalDeparture.svelte`'s markup, ETA format, and scheduled-color while preserving all existing status/frequency/canceled logic. `StopPane.svelte` derives a `routeId → route` color map and adds a section header. `TripDetailsPane.svelte` gets a "Live · vehicle {id}" heading and mockup-style timeline markers. New i18n strings go in the English fallback locale.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), Tailwind CSS, FontAwesome (`@fortawesome/svelte-fontawesome` + `free-solid-svg-icons`), `svelte-i18n`, Vitest + `@testing-library/svelte`.

## Global Constraints

- **Svelte 5 runes only** — `$props`, `$state`, `$derived`, `$effect`. Never write `$state` from inside an `$effect` for pure derivations; use `$derived`.
- **Dynamic hex colors via inline `style`, never Tailwind arbitrary classes** — `class="bg-[#{color}]"` fails silently (Tailwind is build-time). Use `style="background-color: {bg}"`.
- **FontAwesome icons imported from `@fortawesome/free-solid-svg-icons`** — `faTowerBroadcast` exists only in free-solid; `faClock` is in solid too. Import both from solid.
- **WCAG AA contrast** — scheduled gray is `text-gray-500 dark:text-gray-400`. Never `text-gray-400` in light mode (~2.9:1 fails).
- **All user-facing strings localized** — add keys to `src/locales/en.json` (synchronous fallback); interpolate values, never concatenate literals.
- **Test runner:** `npx vitest run <path>` (do NOT use `npm run test` — it hangs in non-TTY).
- **Route colors** are hex strings without `#` on `references.routes[].color` / `.textColor`, joined to arrivals by `routeId`. The arrival object itself has no color.

---

### Task 1: `RouteBadge.svelte` component

**Files:**

- Create: `src/components/RouteBadge.svelte`
- Test: `src/components/__tests__/RouteBadge.test.js`

**Interfaces:**

- Produces: `RouteBadge` Svelte component with props `{ shortName: string, color?: string, textColor?: string }`. Renders a `<div>` containing `shortName` with inline `style="background-color: <bg>; color: <fg>;"` where `bg = color ? '#'+color : '#374151'` and `fg = textColor ? '#'+textColor : '#ffffff'`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/RouteBadge.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, test, describe } from 'vitest';
import RouteBadge from '../RouteBadge.svelte';

describe('RouteBadge', () => {
	test('renders the route short name', () => {
		render(RouteBadge, { props: { shortName: 'C Line' } });
		expect(screen.getByText('C Line')).toBeInTheDocument();
	});

	test('uses the route color as background and text color when provided', () => {
		render(RouteBadge, { props: { shortName: '10', color: 'FF0000', textColor: '00FF00' } });
		const badge = screen.getByText('10');
		expect(badge).toHaveStyle('background-color: #FF0000');
		expect(badge).toHaveStyle('color: #00FF00');
	});

	test('falls back to dark slate background and white text when color is absent', () => {
		render(RouteBadge, { props: { shortName: '21' } });
		const badge = screen.getByText('21');
		expect(badge).toHaveStyle('background-color: #374151');
		expect(badge).toHaveStyle('color: #ffffff');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/RouteBadge.test.js`
Expected: FAIL — cannot resolve `../RouteBadge.svelte` (file does not exist).

- [ ] **Step 3: Create the component**

Create `src/components/RouteBadge.svelte`:

```svelte
<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} shortName - Route short name (e.g. "C Line", "21")
	 * @property {string} [color] - Route color as a hex string without "#" (from references.routes)
	 * @property {string} [textColor] - Route text color as a hex string without "#"
	 */

	/** @type {Props} */
	let { shortName, color = null, textColor = null } = $props();

	let bg = $derived(color ? `#${color}` : '#374151');
	let fg = $derived(textColor ? `#${textColor}` : '#ffffff');
</script>

<div
	class="flex h-14 w-16 shrink-0 items-center justify-center break-words rounded-lg px-1 text-center text-sm font-bold leading-tight"
	style="background-color: {bg}; color: {fg};"
>
	{shortName}
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/RouteBadge.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify Svelte correctness (optional but recommended)**

Use the Svelte MCP `svelte-autofixer` on `src/components/RouteBadge.svelte`. Expected: no issues.

- [ ] **Step 6: Commit**

```bash
git add src/components/RouteBadge.svelte src/components/__tests__/RouteBadge.test.js
git commit -m "feat: add reusable RouteBadge component"
```

---

### Task 2: Redesign `ArrivalDeparture.svelte`

**Files:**

- Modify: `src/locales/en.json` (add `time.min_compact`)
- Modify: `src/components/ArrivalDeparture.svelte` (props, `computeColor`, `computeTimeLabel`, markup, imports)
- Test: `src/components/__tests__/ArrivalDeparture.test.js` (new)

**Interfaces:**

- Consumes: `RouteBadge` from Task 1.
- Produces: `ArrivalDeparture` now accepts an added prop `route` (`{ color?: string, textColor?: string } | null`, default `null`). Its `arrivalInfo` derived object keeps its existing fields (`displayTime`, `color`, `statusText`, `timeText`, `isPredicted`, ...). `timeText` is now the compact form (`"19m"`, `"now"`, `"-3m"`). `color` for non-predicted arrivals is now `text-gray-500 dark:text-gray-400`.

- [ ] **Step 1: Add the compact-ETA i18n key**

In `src/locales/en.json`, find the `"time"` block (around line 139) and add a `min_compact` entry:

```json
	"time": {
		"ago": "ago",
		"now": "now",
		"sec": "sec",
		"secs": "secs",
		"min": "min",
		"mins": "mins",
		"minutes": "minutes",
		"min_compact": "{n}m"
	},
```

- [ ] **Step 2: Write the failing test**

Create `src/components/__tests__/ArrivalDeparture.test.js`. It uses a local `svelte-i18n` mock that interpolates so the compact ETA and status keys render real text:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, test, describe, vi } from 'vitest';

// Local i18n mock that interpolates {name} values (the global setup mock returns keys)
vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: (fn) => {
			fn((key, options) => {
				let str = key;
				if (options?.values) {
					for (const [name, value] of Object.entries(options.values)) {
						str = str.replace(`{${name}}`, value);
					}
				}
				return str;
			});
			return () => {};
		}
	}
}));

import ArrivalDeparture from '../ArrivalDeparture.svelte';

const MIN = 60000;

function baseArrival(overrides = {}) {
	return {
		routeShortName: '10',
		tripHeadsign: 'Downtown Seattle',
		stopSequence: 1,
		predicted: true,
		scheduledArrivalTime: Date.now() + 10 * MIN,
		predictedArrivalTime: Date.now() + 10 * MIN,
		scheduledDepartureTime: Date.now() + 10 * MIN,
		predictedDepartureTime: Date.now() + 10 * MIN,
		tripStatus: null,
		frequency: null,
		...overrides
	};
}

describe('ArrivalDeparture', () => {
	test('renders the headsign and a route badge with the short name', () => {
		render(ArrivalDeparture, {
			props: { arrivalDeparture: baseArrival(), route: { color: 'FF0000', textColor: 'FFFFFF' } }
		});
		expect(screen.getByText('Downtown Seattle')).toBeInTheDocument();
		const badge = screen.getByText('10');
		expect(badge).toHaveStyle('background-color: #FF0000');
	});

	test('renders a compact ETA like "10m"', () => {
		render(ArrivalDeparture, { props: { arrivalDeparture: baseArrival() } });
		expect(screen.getByText('10m')).toBeInTheDocument();
	});

	test('uses gray for scheduled (not predicted) arrivals', () => {
		render(ArrivalDeparture, {
			props: {
				arrivalDeparture: baseArrival({ predicted: false, predictedArrivalTime: null })
			}
		});
		const eta = screen.getByText('10m');
		expect(eta.className).toContain('text-gray-500');
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/ArrivalDeparture.test.js`
Expected: FAIL — the current component renders `10 - Downtown Seattle` and `10 mins`, so `getByText('10m')` and the badge lookup fail.

- [ ] **Step 4: Update imports and the `route` prop**

In `src/components/ArrivalDeparture.svelte`, replace the top of the `<script>` (lines 1–4) with:

```svelte
<script>
	import { t } from 'svelte-i18n';
	import { msToLocalArrivalDepartureTimeString } from '$lib/dateTimeFormat';
	import RouteBadge from '$components/RouteBadge.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTowerBroadcast, faClock } from '@fortawesome/free-solid-svg-icons';
	let { arrivalDeparture, includeArrivalDepartureInStatusLabel = true, route = null } = $props();
```

- [ ] **Step 5: Change scheduled color to gray in `computeColor`**

In `computeColor` (lines 18–34), replace the not-predicted branch:

```js
if (!isPredicted) {
	return 'text-blue-600 dark:text-blue-400';
}
```

with:

```js
if (!isPredicted) {
	// Scheduled (no real-time) arrivals read fully muted, per the mockup.
	// gray-500 passes WCAG AA on white; gray-400 passes on the dark gray-800 surface.
	return 'text-gray-500 dark:text-gray-400';
}
```

- [ ] **Step 6: Make `computeTimeLabel` produce the compact form**

Replace the whole `computeTimeLabel` function (lines 191–201) with:

```js
function computeTimeLabel(eta) {
	if (eta === 0) {
		return $t('time.now');
	}
	// Compact minute form (e.g. "19m", "1m", "-3m"). Unit is localizable.
	return $t('time.min_compact', { values: { n: eta } });
}
```

- [ ] **Step 7: Replace the markup**

Replace the entire markup block (lines 216–231, the two `<div>`s after `</script>`) with:

```svelte
<div class="flex items-center gap-3">
	<RouteBadge shortName={routeShortName} color={route?.color} textColor={route?.textColor} />

	<div class="min-w-0 flex-1">
		<p class="truncate text-lg font-semibold text-gray-900 dark:text-white">
			{tripHeadsign}
		</p>
		<p class="truncate text-sm">
			<span class="text-gray-500 dark:text-gray-400"
				>{msToLocalArrivalDepartureTimeString(arrivalInfo.displayTime)}</span
			>
			<span class="text-gray-500 dark:text-gray-400"> · </span>
			<span class={arrivalInfo.color}>{arrivalInfo.statusText}</span>
		</p>
	</div>

	<div class="flex shrink-0 items-start gap-0.5">
		<span class="text-3xl font-bold leading-none {arrivalInfo.color}">{arrivalInfo.timeText}</span>
		<FontAwesomeIcon
			icon={arrivalInfo.isPredicted ? faTowerBroadcast : faClock}
			class="text-xs {arrivalInfo.color}"
		/>
	</div>
</div>
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/ArrivalDeparture.test.js`
Expected: PASS (3 tests).

- [ ] **Step 9: Run the format/lint check on the changed files**

Run: `npx prettier --check src/components/ArrivalDeparture.svelte src/components/__tests__/ArrivalDeparture.test.js src/locales/en.json`
Expected: all matched files pass. If not, run `npx prettier --write` on them and re-check.

- [ ] **Step 10: Commit**

```bash
git add src/components/ArrivalDeparture.svelte src/components/__tests__/ArrivalDeparture.test.js src/locales/en.json
git commit -m "feat: redesign ArrivalDeparture card with badge, compact ETA, and muted scheduled color"
```

---

### Task 3: `StopPane.svelte` — route-color plumbing + section header

**Files:**

- Modify: `src/components/stops/StopPane.svelte`
- Test: `src/components/stops/__tests__/StopPane.test.js`

**Interfaces:**

- Consumes: `ArrivalDeparture`'s new `route` prop (Task 2).
- Produces: renders an "ARRIVALS & DEPARTURES" header (i18n key `arrivals_and_departures`) above the accordion when arrivals exist; passes `route={routeById.get(arrival.routeId)}` to each `ArrivalDeparture`.

- [ ] **Step 1: Add the header assertion to the existing test**

In `src/components/stops/__tests__/StopPane.test.js`, add `arrivals_and_departures` to the local translations map (inside the `vi.mock('svelte-i18n', ...)` block, the `translations` object near line 113):

```js
const translations = {
	stop: 'Stop',
	routes: 'Routes',
	arrivals_and_departures: 'Arrivals and departures',
	'schedule_for_stop.view_schedule': 'View Schedule',
	load_more_arrivals: 'Load more arrivals',
	no_arrivals_found_in_next_minutes: 'No arrivals found in the next {minutes} minutes'
};
```

Then add a new test (place it after the existing "renders arrivals" style test, e.g. near line 270):

```js
test('renders the ARRIVALS & DEPARTURES section header when arrivals exist', async () => {
	render(StopPane, { props: { stop: mockStopData } });
	await waitFor(() => {
		expect(screen.getByText('Arrivals and departures')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/stops/__tests__/StopPane.test.js -t "section header"`
Expected: FAIL — "Arrivals and departures" is not in the document yet.

- [ ] **Step 3: Add the `routeById` derived map**

In `src/components/stops/StopPane.svelte`, just after the `routeShortNames` derived (line 159), add:

```js
// references.routes carries the per-route color/textColor; the arrival objects
// only carry routeId, so build a lookup to feed RouteBadge via ArrivalDeparture.
let routeById = $derived(
	new Map((arrivalsAndDeparturesResponse?.data?.references?.routes ?? []).map((r) => [r.id, r]))
);
```

- [ ] **Step 4: Add the section header and pass the route down**

In the arrivals-present branch (the `{:else}` at line 316), replace:

```svelte
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
```

with:

```svelte
				{:else}
					<h2
						class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
					>
						{$isLoading ? '' : $t('arrivals_and_departures')}
					</h2>
					{#key arrivalsAndDepartures.stopId}
						<Accordion {handleAccordionSelectionChanged}>
							{#each arrivalsAndDepartures.arrivalsAndDepartures as arrival}
								<AccordionItem data={arrival}>
									{#snippet header()}
										<span class="block flex-1">
											<ArrivalDeparture
												arrivalDeparture={arrival}
												route={routeById.get(arrival.routeId)}
											/>
										</span>
									{/snippet}
```

(The `flex-1` on the wrapper lets the card fill the accordion header row so the chevron sits at the far right.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/stops/__tests__/StopPane.test.js`
Expected: PASS (all existing tests plus the new one).

- [ ] **Step 6: Commit**

```bash
git add src/components/stops/StopPane.svelte src/components/stops/__tests__/StopPane.test.js
git commit -m "feat: add arrivals section header and route colors to StopPane"
```

---

### Task 4: `TripDetailsPane.svelte` — live-vehicle heading + timeline restyle

**Files:**

- Modify: `src/locales/en.json` (add `trip_details.live_vehicle`)
- Modify: `src/components/oba/TripDetailsPane.svelte` (heading, markers, imports)
- Test: `src/components/oba/__tests__/TripDetailsPane.test.js` (new)

**Interfaces:**

- Consumes: nothing new.
- Produces: heading shows "Live · vehicle {vehicleId}" (icon `faTowerBroadcast`) when `tripDetails.status?.vehicleId` is present; otherwise the existing route heading. Timeline markers: intermediate = empty ring, vehicle position = filled dark square with bus, your stop = filled pin.

- [ ] **Step 1: Add the i18n key**

In `src/locales/en.json`, find the `"trip_details"` block and add a `live_vehicle` entry alongside the existing keys (`route`, `no_stops`, `loading`):

```json
		"live_vehicle": "Live · vehicle {vehicleId}"
```

(Add a comma to the preceding entry as needed to keep valid JSON.)

- [ ] **Step 2: Write the failing test**

Create `src/components/oba/__tests__/TripDetailsPane.test.js`:

```js
import { render, screen, waitFor } from '@testing-library/svelte';
import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';

// Local i18n mock that interpolates {vehicleId}
vi.mock('svelte-i18n', () => ({
	_: {
		subscribe: (fn) => {
			fn((key, options) => {
				let str = key;
				if (options?.values) {
					for (const [name, value] of Object.entries(options.values)) {
						str = str.replace(`{${name}}`, value);
					}
				}
				return str;
			});
			return () => {};
		}
	}
}));

import TripDetailsPane from '../TripDetailsPane.svelte';

const stop = { id: '1_75403', name: 'Fauntleroy Way SW & SW Myrtle St' };

function mockTripResponse({ vehicleId }) {
	return {
		data: {
			entry: {
				routeId: '1_100479',
				status: vehicleId ? { vehicleId, closestStop: '1_75403' } : null,
				schedule: {
					stopTimes: [{ stopId: '1_75403', arrivalTime: 41400 }]
				}
			},
			references: {
				routes: [{ id: '1_100479', shortName: 'C Line' }],
				stops: [{ id: '1_75403', name: 'Fauntleroy Way SW & SW Myrtle St' }]
			}
		}
	};
}

describe('TripDetailsPane', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	test('shows a "Live · vehicle {id}" heading when a vehicle is present', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockTripResponse({ vehicleId: '1_8129001' })
		});

		render(TripDetailsPane, { props: { stop, tripId: '1_trip', serviceDate: 123 } });

		await waitFor(() => {
			expect(screen.getByText('trip_details.live_vehicle 1_8129001')).toBeInTheDocument();
		});
	});
});
```

Note: with the interpolating mock, `trip_details.live_vehicle` = `"Live · vehicle {vehicleId}"` is not in the mock's table, so the key text is returned with `{vehicleId}` replaced — asserting the id was interpolated. (The literal prefix differs from prod, but the test proves the vehicle id renders.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/oba/__tests__/TripDetailsPane.test.js`
Expected: FAIL — current heading renders `trip_details.route C Line`, not the live-vehicle text.

- [ ] **Step 4: Update imports**

In `src/components/oba/TripDetailsPane.svelte`, change the icon import (line 4) to add the broadcast icon:

```js
import { faBus, faLocationDot, faCheck, faTowerBroadcast } from '@fortawesome/free-solid-svg-icons';
```

- [ ] **Step 5: Replace the heading**

Replace the route-heading block (lines 101–106):

```svelte
{#if routeInfo}
	<h2 class="h2">
		{$_('trip_details.route')}
		{routeInfo.shortName}
	</h2>
{/if}
```

with a live-vehicle heading that falls back to the route heading:

```svelte
{#if tripDetails.status?.vehicleId}
	<h2 class="h2 flex items-center gap-2">
		<FontAwesomeIcon icon={faTowerBroadcast} class="text-brand" />
		{$_('trip_details.live_vehicle', { values: { vehicleId: tripDetails.status.vehicleId } })}
	</h2>
{:else if routeInfo}
	<h2 class="h2">
		{$_('trip_details.route')}
		{routeInfo.shortName}
	</h2>
{/if}
```

- [ ] **Step 6: Restyle the timeline markers**

Replace the marker `<div>` (lines 113–134, the `relative flex size-8 ...` block and its icon logic) with mockup-style markers — filled dark square + bus at the vehicle position, filled pin at your stop, empty ring otherwise:

```svelte
{#if index === busPosition}
	<div
		class="relative flex size-8 items-center justify-center rounded-md bg-neutral-800 dark:bg-neutral-200"
	>
		<FontAwesomeIcon icon={faBus} class="text-sm text-white dark:text-neutral-900" />
		{#if tripStop.stopId === stop.id}
			<FontAwesomeIcon
				icon={faCheck}
				class="absolute -right-1 -top-1 rounded-full border border-white bg-brand p-1 text-xs text-white"
			/>
		{/if}
	</div>
{:else if tripStop.stopId === stop.id}
	<div class="flex size-8 items-center justify-center">
		<FontAwesomeIcon icon={faLocationDot} class="text-xl text-brand-accent" />
	</div>
{:else}
	<div class="flex size-8 items-center justify-center">
		<div class="size-4 rounded-full border-2 border-neutral-400 bg-white dark:bg-neutral-800"></div>
	</div>
{/if}
```

Then, so the "your stop" row reads as the emphasized destination (mockup bold), update the stop-name `<div>` (line 136) to bold your stop:

```svelte
<div
	class="text-md dark:text-white"
	class:font-bold={tripStop.stopId === stop.id}
	class:font-semibold={tripStop.stopId !== stop.id}
>
	{stopInfo[tripStop.stopId] ? stopInfo[tripStop.stopId].name : tripStop.stopId}
</div>
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/oba/__tests__/TripDetailsPane.test.js`
Expected: PASS.

- [ ] **Step 8: Run prettier on the changed files**

Run: `npx prettier --check src/components/oba/TripDetailsPane.svelte src/components/oba/__tests__/TripDetailsPane.test.js src/locales/en.json`
Expected: pass (else `--write` and re-check).

- [ ] **Step 9: Commit**

```bash
git add src/components/oba/TripDetailsPane.svelte src/components/oba/__tests__/TripDetailsPane.test.js src/locales/en.json
git commit -m "feat: restyle trip timeline with live-vehicle heading and mockup markers"
```

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (no regressions in StopPane, RouteItem, dateTimeFormat, etc.).

- [ ] **Step 2: Lint & format**

Run: `npm run lint`
Expected: passes. If formatting fails, run `npm run format` then re-run `npm run lint`.

- [ ] **Step 3: Production build sanity check**

Run: `npm run build`
Expected: build succeeds (catches any Svelte/import errors the unit tests miss).

- [ ] **Step 4: Manual visual check (recommended)**

Run `npm run dev`, open a stop with mixed real-time and scheduled arrivals, and confirm against the mockup: colored route badges (red C Line, dark numbered routes), bold headsign, gray `time · status` with colored status, large compact ETA (`19m`) with broadcast/clock icon, the "ARRIVALS & DEPARTURES" header, and an expanded row showing the "Live · vehicle …" heading with the restyled timeline. Verify light and dark mode.

---

## Self-Review Notes

- **Spec coverage:** RouteBadge (Task 1), ArrivalDeparture redesign incl. compact ETA + gray scheduled + icons (Task 2), StopPane route-color map + section header (Task 3), TripDetailsPane heading + timeline (Task 4), tests + i18n keys throughout, full verification (Task 5). "Past · N" counter intentionally deferred per spec. ✓
- **Type/name consistency:** `route` prop shape `{ color, textColor }` is produced by `routeById.get(...)` in Task 3 and consumed by `RouteBadge` in Task 1 via Task 2; `routeById` used consistently. ✓
- **No placeholders:** every code step shows complete code and exact commands. ✓
- **Note on existing tests:** there was no pre-existing `ArrivalDeparture.svelte` or `TripDetailsPane.svelte` test, and `StopPane.test.js` mocks both child components — so the redesign creates new tests rather than breaking old assertions.
