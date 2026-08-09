# Survey Banner (compact hero question) — Design

Date: 2026-08-07
Branch: `survey-hero-compact`

## Problem

The survey hero question renders on the stop pane as a tall inset card (`HeroQuestion.svelte`):
a rounded gray panel with the survey name as an `h2`, the full question, all options, and a
Submit button. It consumes most of the visible stop pane, pushing the arrivals list — the reason
the user opened the pane — below the fold.

The current implementation also carries four defects in the code path being redesigned. They are
in scope because the redesign cannot be built correctly on top of them:

1. `HeroQuestion.svelte:27` passes `error={[false]}` to `SurveyQuestion`. An array is truthy, so
   `SurveyQuestion.svelte:104` renders "This question is required." on first paint, before the
   user has touched anything.
2. `SurveyQuestion.svelte:32` reassigns its own `error` prop from `value`, but `value` is
   `$bindable('')` and nothing ever writes to it (the `Radio` gets `group={value}` one-way at
   line 60, and `HeroQuestion` never passes `value` at all). So the child flips `error` to `true`
   on the first interaction with any required question and the parent never resyncs it.
3. `StopPane.svelte:63` declares `remainingSurveyQuestions = $state([])` and the only assignment
   is at line 228, _inside_ `handleSurveyButtonClick`. At render time the length is therefore
   always `0`, so the "Next" button label has never been reachable.
4. `StopPane.svelte:266` sets `heroAnswer = event.target.value`. For a `checkbox` hero question
   only the last-clicked option is ever submitted, and _unchecking_ a box still leaves
   `heroAnswer` non-empty.

## Solution

Replace the card with a full-bleed, collapsible banner strip. Collapsed by default: one compact
row teasing the survey. Expanded on tap: the hero question, its options, and Submit.

## Component

New `src/components/surveys/SurveyBanner.svelte`, replacing
`src/components/surveys/HeroQuestion.svelte` (the old name no longer describes what the component
is). Rendered from `StopPane.svelte` in the same slot: after `ServiceAlerts`, before the arrivals
accordion.

Props:

| Prop                       | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `currentStopSurvey`        | The survey object from `surveyStore`                            |
| `handleSkip`               | Dismiss — calls `skipSurvey` in `StopPane`                      |
| `handleSurveyButtonClick`  | Submit — POSTs the hero answer in `StopPane`; **awaited**       |
| `handleHeroQuestionChange` | Answer change — now receives the resolved answer, not the event |
| `remainingQuestionsLength` | Drives the Submit vs. Next button label                         |

`remainingQuestionsLength` must be derived in `StopPane` from
`(currentStopSurvey?.questions?.length ?? 1) - 1` rather than read from the `remainingSurveyQuestions`
state, which is empty until `handleSurveyButtonClick` runs. This makes the "Next" label reachable
for the first time; it is a behavior fix, not a port.

### Render guard

Render nothing unless `currentStopSurvey?.questions?.length`. Both `HeroQuestion.svelte:22-24`
and `StopPane.svelte:227` index `questions[0]` behind a gate that only checks the survey object
exists (`StopPane.svelte:337`), so a survey with an empty `questions` array throws on render
today.

### Layout — collapsed

Full-bleed via `-mx-4 px-4`, with `border-y border-gray-200 dark:border-gray-700`. Background
`bg-primary-100 dark:bg-gray-800`.

Row contents, left to right:

1. A 48px `rounded-xl bg-brand-accent text-brand-foreground` tile containing `faCommentDots`,
   marked `aria-hidden="true"` (see Accessibility).
2. A text block: bold `currentStopSurvey.name`, and below it the hero question's
   `content.label_text` in a smaller muted weight. Both `truncate` inside a `min-w-0` flex child
   so long strings clip rather than push the controls off-screen.
3. A chevron (`faChevronDown` / `faChevronUp`).
4. A separate `×` dismiss button.

Items 2 and 3 sit inside a single `<button>` that toggles expansion, carrying `aria-expanded`.
The `×` is its own button with an `aria-label`, so dismiss is never confused with expand.

The banner's text must not use `h1`–`h6`. `StopPane.test.js:507-526` asserts the pane contains
exactly two `h2` elements; today's `HeroQuestion.svelte:20` renders one, and that test only
passes because the component is mocked. Using `<p>`/`<span>` keeps the banner out of the heading
tree regardless of mocking.

### Layout — expanded

Header row unchanged except the chevron flips. Below it, in the same tinted background,
revealed with `transition:slide` at the 300ms used by `AccordionItem.svelte:60-65` so the banner
opens like the arrival rows beside it:

- The hero question rendered by `SurveyQuestion` with `variant="compact"`, `value={answer}`, and
  `error={showRequiredError}`. The question label wraps in full here; the header's copy of it
  stays truncated. This duplication is intentional and matches the approved mockup.
- A right-aligned Submit button, `disabled` and visually muted until an answer exists, and
  disabled again while a submit is in flight.

### Spacing — removing `space-y-4`

`StopPane.svelte:299` wraps the pane contents in `<div class="space-y-4">`, which would put a
16px gap between the banner and the arrivals list. The banner must sit flush against the rows
below it. Replace `space-y-4` on that wrapper with explicit spacing on the children that still
need it — `mb-4` on the hero-card block and on `ServiceAlerts`, `mt-4` on the load-more
container — leaving the banner and the accordion flush.

Note a pre-existing inconsistency this reveals but does not fix: `SingleSelectAccordion.svelte:45`
puts `divide-y border-b` on a wrapper that has no `-mx-4`, while each `AccordionItem` header
bleeds via `-mx-4` (`AccordionItem.svelte:30`). Arrival hairlines are therefore inset 1rem while
row backgrounds bleed. The banner's own borders bleed to the edges, matching the mockup;
reconciling the accordion's inset dividers is out of scope.

### Full-bleed constraint

`-mx-4` is correct in both containers that host `StopPane`, with no conditional needed:

- Bottom sheet body: `px-4` at `BottomSheet.svelte:126`, chosen for exactly this reason, plus
  `overflow-x-hidden`.
- Standalone page: `StandalonePage.svelte:11` is `mx-auto h-full max-w-5xl overflow-y-auto p-4`,
  and `src/routes/stops/[stopID]/+page.svelte:47` renders `StopPane` directly inside it.

This couples the banner to both containers' 1rem horizontal padding. `StandalonePage` has no
`overflow-x-hidden` guard, so a future padding change there would produce a horizontal
scrollbar. On the standalone page the band bleeds to the `max-w-5xl` edge, which is wide on
desktop — consistent with the arrival rows, which already do this.

## Behavior

### State ownership

The banner owns the answer. It keeps `answer` as `$state` — a string for `text`/`radio`, an
array for `checkbox` — updates it from the change event (`event.target.value`, or
`event.target.checked` plus the option value for checkboxes), passes it down as `value={answer}`,
and passes the resolved value up via `handleHeroQuestionChange(answer)`.

Consequently `StopPane.handleHeroQuestionChange` changes signature from `(event)` to `(answer)`
and simply assigns `heroAnswer = answer`. `StopPane.svelte:229`'s emptiness guard must then
handle arrays as well as strings.

`SurveyQuestion.svelte:32` — the `error = required && ...` self-assignment — is deleted. Error
becomes purely parent-owned. This also fixes the same latent bug for `SurveyModal`, which
already passes a real `error` prop and its own `validateAnswers`.

### Interactions

- **Default state:** collapsed. Wrap the banner in `{#key stop.id}` so expanded/answer/error
  state resets when the user selects a different stop. Without it, `MapExperience.svelte:536`
  renders `StopBottomSheet` with no `{#key}`, so switching stops with the sheet open does not
  remount `StopPane` or its children and the previous stop's banner state carries over.
- **Toggle:** clicking the header text/chevron button expands or collapses the body.
- **Submit:** `await handleSurveyButtonClick()`. On success, existing `StopPane` code POSTs the
  hero answer, sets `showHeroQuestion = false` (unmounting the banner), opens `SurveyModal` when
  questions remain, and calls `markSurveyAnswered`.
- **Submit failure:** `submitHeroQuestion` rethrows on a non-OK response
  (`surveyUtils.js:129-137`) and `handleSurveyButtonClick` does not catch it
  (`StopPane.svelte:255`), so today a failure is an unhandled rejection that shows the user
  nothing. `handleSurveyButtonClick` gains a `try/catch` that leaves `showHeroQuestion` true and
  rethrows to the banner; the banner shows an inline `survey.submit_failed` message and
  re-enables Submit.
- **Double submit:** the banner sets `submitting = true` for the duration of the await and
  disables Submit, so a double-tap cannot POST twice.
- **Dismiss:** delegates to `handleSkip` → `skipSurvey`. Note this is **permanent** for ordinary
  surveys: `surveyUtils.js:173-186` only writes the one-week timestamp when
  `allows_multiple_responses && always_visible`; otherwise it sets `survey_<id>_skipped = true`,
  which `getValidSurveys` (line 49) treats as forever. That is existing behavior and stays, but
  it is why `×` gets a clear `aria-label` rather than being a bare glyph.

### Question types

| Type                        | Banner behavior                                                              |
| --------------------------- | ---------------------------------------------------------------------------- |
| `radio`, `checkbox`, `text` | Normal: Submit enabled once `answer` is non-empty                            |
| `label`                     | No answer needed; Submit enabled immediately (matches `StopPane.svelte:229`) |
| `external_survey`           | Expanded body renders the link only, with **no Submit button**               |

`external_survey` gets no Submit because it never fires `onInputChange` — `SurveyQuestion.svelte:86-101`
renders a bare `<a>` with no handler — so `heroAnswer` stays `''` and `StopPane.svelte:229`
returns early forever. Today that ships a button that silently does nothing. Omitting the button
avoids modifying `StopPane`'s guard.

### Error state

`showRequiredError` starts `false`, flips to `true` only when Submit is pressed with a required
question unanswered, and returns to `false` as soon as an answer exists.

## Theming

No new Tailwind token. `tailwind.config.js:32` already wires
`primary: generatePalette(COLOR_BRAND_ACCENT)`, and `colorUtils.js:100` defines shade `100` as a
0.9 white mix of the accent — byte-identical to the `lightenColor(accent, 0.9)` token originally
proposed here. Use `bg-primary-100`, which tracks any configured brand color for free.

Dark mode uses `dark:bg-gray-800`: a lightened brand hue does not read as a surface against a
dark background. The icon tile keeps `bg-brand-accent` in both modes.

## Accessibility

- The icon tile is `aria-hidden="true"` and decorative. `bg-brand-accent` (`#486621`) on
  `dark:bg-gray-800` (`#1f2937`) is 2.24:1, below the 3:1 WCAG 1.4.11 floor for meaningful
  non-text UI. It carries no information the adjacent text does not, so decorative is the honest
  classification. (The white glyph on the tile is 6.57:1 and fine.)
- The toggle uses `aria-expanded` **without** `aria-controls`. The body is unmounted when
  collapsed, and `aria-controls` pointing at a non-existent id is invalid.
- The banner does not bind Escape. `StopBottomSheet.svelte:74` uses
  `use:keybinding={{ code: 'Escape' }}` and `keybinding.js:34` registers on `window`, so Escape
  anywhere in the sheet closes the entire sheet.

## Internationalization

New keys under `survey` in `src/locales/en.json`:

| Key                      | English                                      |
| ------------------------ | -------------------------------------------- |
| `survey.expand`          | Show question                                |
| `survey.collapse`        | Hide question                                |
| `survey.dismiss`         | Dismiss survey                               |
| `survey.submit`          | Submit                                       |
| `survey.next`            | Next                                         |
| `survey.required_answer` | This question is required.                   |
| `survey.submit_failed`   | Couldn't send your answer. Please try again. |

These replace the hardcoded `Submit`, `Next`, and `title="Skip hero question"` in the current
component, and the hardcoded English at `SurveyQuestion.svelte:105`.

Two acknowledged inconsistencies, both out of scope: `SurveyModal.svelte:165/171/179/187` keeps
hardcoded `Cancel`/`Next`/`Skip`/`Submit`, so `Next` and `Submit` will briefly exist as both a
key and a literal; and no locale other than `en` currently defines a `survey` key at all, so the
fallback path is exercised for every non-English user.

## Testing

New `src/components/surveys/__tests__/SurveyBanner.test.js`:

- renders nothing when the survey has no questions
- renders collapsed by default — question body absent, `aria-expanded` is `false`
- clicking the toggle reveals the body and sets `aria-expanded` to `true`
- clicking `×` calls `handleSkip` and not `handleSurveyButtonClick`
- Submit is disabled before an answer and enabled after
- Submit with a required question unanswered shows the required message; the message is absent
  on first render
- checkbox hero: checking two options then unchecking one yields the remaining option, and
  unchecking the last one disables Submit again
- `external_survey` hero renders the link and no Submit button
- Submit is disabled while the awaited handler is in flight, and a rejected handler re-enables it
  and shows `survey.submit_failed`

`$t` is mocked to return the key in both `vitest-setup.js:41-47` and `StopPane.test.js:112-142`,
so assertions match on `survey.submit`, not "Submit".

`src/components/stops/__tests__/StopPane.test.js:61` mocks
`$components/surveys/HeroQuestion.svelte`; repoint it at `SurveyBanner.svelte`. This matters more
than it looks: line 494 overwrites the `surveyStore` mock to emit a survey and `vi.clearAllMocks()`
(line 149) clears calls but not implementations, so every test after that point renders with a
survey present.

Run tests with `npx vitest run` — `npm run test` hangs in a non-TTY shell.

## Out of scope

- `SurveyModal.svelte` — the multi-question flow after the hero answer is unchanged, apart from
  benefiting from the `SurveyQuestion` error fix.
- `SurveyLauncher.svelte` — the map-level survey card is a different surface.
- The accordion's inset-divider/full-bleed-background mismatch.
- `SurveyModal`'s hardcoded button strings.
- The stop pane's arrivals list, header, and toolbar.
