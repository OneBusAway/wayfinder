# Survey Banner (compact hero question) — Design

Date: 2026-08-07
Branch: `survey-hero-compact`

## Problem

The survey hero question renders on the stop pane as a tall inset card (`HeroQuestion.svelte`):
a rounded gray panel with the survey name as an `h2`, the full question, all options, and a
Submit button. It consumes most of the visible stop pane, pushing the arrivals list — the reason
the user opened the pane — below the fold.

It also has a visible defect: `StopPane.svelte` passes `error={[false]}` to `SurveyQuestion`.
An array is truthy, so the red "This question is required." message renders before the user has
interacted with anything.

## Solution

Replace the card with a full-bleed, collapsible banner strip that sits flush in the stop pane's
existing hairline-separated row rhythm. Collapsed by default: one compact row teasing the survey.
Expanded on tap: the hero question, its options, and Submit.

## Component

New `src/components/surveys/SurveyBanner.svelte`, replacing `src/components/surveys/HeroQuestion.svelte`
(the old name no longer describes what the component is). Rendered from `StopPane.svelte` in the
same slot as today: after `ServiceAlerts`, before the arrivals accordion.

Props (unchanged from `HeroQuestion` today):

| Prop | Purpose |
| --- | --- |
| `currentStopSurvey` | The survey object from `surveyStore` |
| `handleSkip` | Dismiss — calls `skipSurvey` in `StopPane` |
| `handleSurveyButtonClick` | Submit — POSTs hero answer in `StopPane` |
| `handleHeroQuestionChange` | Answer change — sets `heroAnswer` in `StopPane` |
| `remainingQuestionsLength` | Drives the Submit vs. Next button label |

`StopPane`'s submit/skip/change handlers are not modified. The banner owns only presentation
state (expanded, answered, error).

### Layout — collapsed

Full-bleed via `-mx-4` with `border-y border-gray-200 dark:border-gray-700`, matching the
`fullBleed` `AccordionItem` rows above and below it. Background `bg-brand-subtle dark:bg-gray-800`.

Row contents, left to right:

1. A 48px `rounded-xl bg-brand-accent text-brand-foreground` tile containing `faCommentDots`.
2. A text block: bold `currentStopSurvey.name`, and below it the hero question's
   `content.label_text` in a smaller muted weight. Both `truncate` with `min-w-0` so long
   strings clip rather than push the controls off-screen.
3. A chevron (`faChevronDown` / `faChevronUp`).
4. A separate `×` dismiss button.

Items 2 and 3 are inside a single `<button>` that toggles expansion, carrying `aria-expanded`
and `aria-controls` pointing at the body element's id. The `×` is its own button so dismiss is
never confused with expand.

### Layout — expanded

Header row is unchanged except the chevron flips. Below it, in the same tinted background:

- The hero question rendered by the existing `SurveyQuestion` component with `variant="compact"`.
  The question label wraps in full here; the header's copy of it stays truncated. This
  duplication is intentional and matches the approved mockup.
- A right-aligned Submit button, `disabled` and visually muted until an answer exists. Label is
  `survey.submit` when `remainingQuestionsLength === 0`, otherwise `survey.next` — the same rule
  the current component uses.

## Behavior

- **Default state:** collapsed on every stop-pane open. Expansion state is component-local and
  not persisted.
- **Toggle:** clicking the header text/chevron button expands or collapses the body.
- **Submit:** delegates to `handleSurveyButtonClick`. That existing code POSTs the hero answer,
  sets `showHeroQuestion = false` (unmounting the banner), opens `SurveyModal` when questions
  remain, and calls `markSurveyAnswered`.
- **Dismiss:** delegates to `handleSkip`, which calls `skipSurvey` (one-week suppression via
  localStorage) and unmounts the banner.
- **Answer tracking:** the banner wraps `handleHeroQuestionChange` so it can track whether an
  answer exists, which drives the Submit button's disabled state. It still forwards every event
  to `StopPane` unchanged.
- **Question types:** `label` and `external_survey` hero questions remain submittable with no
  answer, as `handleSurveyButtonClick` already allows for `label`. For these types the Submit
  button is enabled immediately.

### Error state

The banner owns error state, initialized to `false` and passed to `SurveyQuestion` as a boolean.
It flips to `true` only when Submit is pressed with a required question left unanswered, and
back to `false` once an answer is provided. This replaces the `error={[false]}` array currently
passed from `StopPane`, which made the required-question message permanently visible.

## Theming

`tailwind.config.js` gains one derived token beside the existing `brand-accent-dark`:

```js
'brand-subtle': lightenColor(process.env.COLOR_BRAND_ACCENT || '#486621', 0.9)
```

`lightenColor` is exported from `src/lib/colorUtils.js` with fallback handling for invalid input,
but is not yet imported by `tailwind.config.js` — add it to the existing
`{ generatePalette, darkenColor }` import. The banner uses `bg-brand-subtle` in light mode and `dark:bg-gray-800` in dark mode — a
lightened brand hue would not read as a surface against a dark background, so dark mode uses the
neutral surface the rest of the pane uses. The icon tile keeps `bg-brand-accent` in both modes.

## Internationalization

New keys under `survey` in `src/locales/en.json`:

| Key | English |
| --- | --- |
| `survey.expand` | Show question |
| `survey.collapse` | Hide question |
| `survey.dismiss` | Dismiss survey |
| `survey.submit` | Submit |
| `survey.next` | Next |
| `survey.required_answer` | This question is required. |

These replace the hardcoded `Submit`, `Next`, and `title="Skip hero question"` in the current
component. `survey.required_answer` replaces the hardcoded English string in
`SurveyQuestion.svelte`. English only; other locales fall back to English per `src/lib/i18n.js`.

## Testing

New `src/components/surveys/__tests__/SurveyBanner.test.js`:

- renders collapsed by default — question body is absent, `aria-expanded` is `false`
- clicking the toggle reveals the body and sets `aria-expanded` to `true`
- clicking `×` calls `handleSkip` and does not call `handleSurveyButtonClick`
- Submit is disabled before an answer is selected and enabled after
- Submit with a required question unanswered shows the required message; the message is absent
  on first render

`src/components/stops/__tests__/StopPane.test.js` mocks `$components/surveys/HeroQuestion.svelte`;
update that mock to the new path.

Run tests with `npx vitest run` (`npm run test` hangs in a non-TTY shell).

## Out of scope

- `SurveyModal.svelte` — the multi-question flow after the hero answer is unchanged.
- `SurveyLauncher.svelte` — the map-level survey card is a different surface.
- The stop pane's arrivals list, header, and toolbar.
