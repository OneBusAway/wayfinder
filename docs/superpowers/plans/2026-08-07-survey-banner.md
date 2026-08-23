# Survey Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tall survey hero-question card on the stop pane with a compact, full-bleed, collapsible banner.

**Architecture:** A new `SurveyBanner.svelte` owns all presentation state (expanded, answer, error, in-flight) and delegates submit/skip to the handlers `StopPane.svelte` already has. `SurveyQuestion.svelte` becomes a fully controlled component — it stops reassigning its own `error` prop. `StopPane` keeps ownership of the network call, but its answer handler changes signature to receive a resolved answer value instead of a DOM event.

**Tech Stack:** SvelteKit 5 (runes + snippets), Tailwind CSS, flowbite-svelte, FontAwesome via `@fortawesome/svelte-fontawesome`, `svelte-i18n`, Vitest + `@testing-library/svelte`.

Spec: `docs/superpowers/specs/2026-08-07-survey-banner-design.md`

## Global Constraints

- Run tests with `npx vitest run` — `npm run test` hangs in a non-TTY shell.
- Run `npm run format` before committing; the repo uses Prettier with tabs.
- Svelte 5 runes only: `$props`, `$state`, `$derived`. No `export let`, no stores for local state.
- All user-visible strings go through `$t('...')`. English lives in `src/locales/en.json`; do not edit other locale files.
- The banner must not render any `h1`–`h6` element. `StopPane.test.js:507-526` asserts the pane contains exactly two `h2` elements.
- Use path aliases: `$components`, `$lib`, `$stores`.
- Do not modify `SurveyModal.svelte`, `SurveyLauncher.svelte`, or the arrivals accordion.

## File Structure

| File                                                    | Responsibility                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/components/surveys/SurveyQuestion.svelte`          | **Modify.** Stop self-assigning `error`; i18n the required message.                                 |
| `src/components/surveys/SurveyBanner.svelte`            | **Create.** The collapsible banner. Owns expanded/answer/error/in-flight state.                     |
| `src/components/surveys/HeroQuestion.svelte`            | **Delete.** Superseded by `SurveyBanner.svelte`.                                                    |
| `src/components/stops/StopPane.svelte`                  | **Modify.** Wire in the banner; fix answer handler, submit error handling, question count, spacing. |
| `src/locales/en.json`                                   | **Modify.** New `survey.*` keys.                                                                    |
| `src/components/surveys/__tests__/SurveyBanner.test.js` | **Create.** Banner behavior tests.                                                                  |
| `src/components/stops/__tests__/StopPane.test.js`       | **Modify.** Repoint the component mock.                                                             |

---

### Task 1: Make `SurveyQuestion` a controlled component

`SurveyQuestion.handleInput` reassigns its own `error` prop from `value`, but `value` is `$bindable('')` and nothing ever writes to it — `Radio` gets `group={value}` one-way and `HeroQuestion` never passes `value` at all. The result is that `error` flips to `true` on the first interaction with any required question and the parent never resyncs it. Error must be owned entirely by the parent.

**Files:**

- Modify: `src/components/surveys/SurveyQuestion.svelte:30-33` and `:104-106`
- Modify: `src/locales/en.json`
- Test: `src/components/surveys/__tests__/SurveyQuestion.test.js` (create)

**Interfaces:**

- Consumes: nothing.
- Produces: `SurveyQuestion` props contract used by Task 3 — `{ question, index, value, required, onInputChange, variant, error }`. `error` is a boolean the parent controls; the component never writes to it. `onInputChange` is called as `onInputChange(event, question, index)`.

- [ ] **Step 1: Write the failing test**

Create `src/components/surveys/__tests__/SurveyQuestion.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi } from 'vitest';
import SurveyQuestion from '../SurveyQuestion.svelte';

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
			return { unsubscribe: () => {} };
		})
	}
}));

const radioQuestion = {
	id: 1,
	required: true,
	content: {
		type: 'radio',
		label_text: 'How easy was it to use the app?',
		options: ['Very Easy', 'Neutral']
	}
};

describe('SurveyQuestion', () => {
	test('does not show the required message when the parent says there is no error', async () => {
		const user = userEvent.setup();

		render(SurveyQuestion, {
			props: {
				question: radioQuestion,
				index: 0,
				required: true,
				value: '',
				onInputChange: vi.fn(),
				error: false
			}
		});

		expect(screen.queryByText('survey.required_answer')).not.toBeInTheDocument();

		await user.click(screen.getByLabelText('Very Easy'));

		// The component must not decide on its own that this is an error.
		expect(screen.queryByText('survey.required_answer')).not.toBeInTheDocument();
	});

	test('shows the required message when the parent says there is an error', () => {
		render(SurveyQuestion, {
			props: {
				question: radioQuestion,
				index: 0,
				required: true,
				value: '',
				onInputChange: vi.fn(),
				error: true
			}
		});

		expect(screen.getByText('survey.required_answer')).toBeInTheDocument();
	});

	test('forwards the change event to onInputChange with the question and index', async () => {
		const user = userEvent.setup();
		const onInputChange = vi.fn();

		render(SurveyQuestion, {
			props: {
				question: radioQuestion,
				index: 0,
				required: true,
				value: '',
				onInputChange,
				error: false
			}
		});

		await user.click(screen.getByLabelText('Very Easy'));

		expect(onInputChange).toHaveBeenCalledWith(expect.anything(), radioQuestion, 0);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/surveys/__tests__/SurveyQuestion.test.js`

Expected: the first test FAILS — after the click, `survey.required_answer` is in the document (the component set `error = true` itself). The second test also FAILS because the string is currently the hardcoded English "This question is required."

- [ ] **Step 3: Remove the self-assignment and i18n the message**

In `src/components/surveys/SurveyQuestion.svelte`, replace lines 30-33:

```svelte
	function handleInput(event) {
		onInputChange(event, question, index);
		error = required && (!value || (Array.isArray(value) && value.length === 0));
	}
```

with:

```svelte
	// `error` is owned by the parent. This component never decides on its own
	// that an answer is missing — it only reports the change upward.
	function handleInput(event) {
		onInputChange(event, question, index);
	}
```

Then replace lines 104-106:

```svelte
{#if error && question.content.type !== 'label'}
	<p class={`${errorClasses.label} mt-4`}>This question is required.</p>
{/if}
```

with:

```svelte
{#if error && question.content.type !== 'label'}
	<p class={`${errorClasses.label} mt-4`}>{$t('survey.required_answer')}</p>
{/if}
```

- [ ] **Step 4: Add the locale key**

In `src/locales/en.json`, the `survey` object currently contains only `required_question`. Add `required_answer` alongside it:

```json
	"survey": {
		"required_question": "Required question",
		"required_answer": "This question is required."
	},
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/surveys/__tests__/SurveyQuestion.test.js`
Expected: PASS, 3 tests.

Then run the existing survey tests to confirm nothing regressed:

Run: `npx vitest run src/tests/lib/surveysUtils.test.js src/components/stops/__tests__/StopPane.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/components/surveys/SurveyQuestion.svelte src/components/surveys/__tests__/SurveyQuestion.test.js src/locales/en.json
git commit -m "fix(surveys): make SurveyQuestion error state parent-owned

SurveyQuestion reassigned its own error prop from a value prop nothing
ever wrote to, so the required-question message appeared on first
interaction and never cleared. Error is now purely controlled by the
parent, and the message is internationalized."
```

---

### Task 2: Add the banner's locale keys

Small and mechanical, but Task 3's tests assert on these key names, so they land first.

**Files:**

- Modify: `src/locales/en.json`

**Interfaces:**

- Consumes: the `survey` object from Task 1.
- Produces: keys `survey.expand`, `survey.collapse`, `survey.dismiss`, `survey.submit`, `survey.next`, `survey.submit_failed`.

- [ ] **Step 1: Add the keys**

In `src/locales/en.json`, the `survey` object should end up as:

```json
	"survey": {
		"required_question": "Required question",
		"required_answer": "This question is required.",
		"expand": "Show question",
		"collapse": "Hide question",
		"dismiss": "Dismiss survey",
		"submit": "Submit",
		"next": "Next",
		"submit_failed": "Couldn't send your answer. Please try again."
	},
```

Do not edit any other locale file — `src/lib/i18n.js` falls back to English.

- [ ] **Step 2: Verify the file is still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/en.json','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
npm run format
git add src/locales/en.json
git commit -m "i18n: add survey banner strings"
```

---

### Task 3: Create `SurveyBanner.svelte` — collapsed state

The banner's default, collapsed appearance: icon tile, survey name, truncated question, chevron toggle, dismiss button. No question body yet — that is Task 4.

**Files:**

- Create: `src/components/surveys/SurveyBanner.svelte`
- Test: `src/components/surveys/__tests__/SurveyBanner.test.js` (create)

**Interfaces:**

- Consumes: `survey.*` locale keys from Task 2.
- Produces: the component `SurveyBanner.svelte` with props
  `{ currentStopSurvey, handleSkip, handleSurveyButtonClick, handleHeroQuestionChange, remainingQuestionsLength }`.
  `handleSurveyButtonClick` is called with no arguments and **awaited**; it may reject.
  `handleHeroQuestionChange` is called with the resolved answer value (a `string`, or a
  `string[]` for checkbox questions) — **not** a DOM event. Task 5 relies on both of these.

- [ ] **Step 1: Write the failing test**

Create `src/components/surveys/__tests__/SurveyBanner.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import SurveyBanner from '../SurveyBanner.svelte';

vi.mock('svelte-i18n', () => ({
	t: {
		subscribe: vi.fn((fn) => {
			fn((key) => key);
			return { unsubscribe: () => {} };
		})
	}
}));

function surveyWithHero(content, { required = true } = {}) {
	return {
		id: 7,
		name: 'How easy is OneBusAway to use?',
		questions: [{ id: 1, required, content }]
	};
}

const radioContent = {
	type: 'radio',
	label_text: 'How easy was it to navigate and use the app?',
	options: ['Very Easy', 'Neutral', 'Very Difficult']
};

function defaultProps(overrides = {}) {
	return {
		currentStopSurvey: surveyWithHero(radioContent),
		handleSkip: vi.fn(),
		handleSurveyButtonClick: vi.fn().mockResolvedValue(undefined),
		handleHeroQuestionChange: vi.fn(),
		remainingQuestionsLength: 0,
		...overrides
	};
}

describe('SurveyBanner — collapsed', () => {
	let user;

	beforeEach(() => {
		user = userEvent.setup();
	});

	test('renders nothing when the survey has no questions', () => {
		const { container } = render(SurveyBanner, {
			props: defaultProps({ currentStopSurvey: { id: 7, name: 'Empty', questions: [] } })
		});

		expect(container.textContent.trim()).toBe('');
	});

	test('renders nothing when there is no survey at all', () => {
		const { container } = render(SurveyBanner, {
			props: defaultProps({ currentStopSurvey: null })
		});

		expect(container.textContent.trim()).toBe('');
	});

	test('shows the survey name and the hero question, collapsed by default', () => {
		render(SurveyBanner, { props: defaultProps() });

		expect(screen.getByText('How easy is OneBusAway to use?')).toBeInTheDocument();
		expect(screen.getByText(radioContent.label_text)).toBeInTheDocument();

		const toggle = screen.getByRole('button', { name: /survey.expand/ });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');

		// The answer options belong to the body, which is collapsed.
		expect(screen.queryByLabelText('Very Easy')).not.toBeInTheDocument();
	});

	test('renders no heading elements', () => {
		render(SurveyBanner, { props: defaultProps() });

		expect(screen.queryAllByRole('heading')).toHaveLength(0);
	});

	test('toggling expands the banner and updates aria-expanded', async () => {
		render(SurveyBanner, { props: defaultProps() });

		await user.click(screen.getByRole('button', { name: /survey.expand/ }));

		expect(screen.getByRole('button', { name: /survey.collapse/ })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		expect(screen.getByLabelText('Very Easy')).toBeInTheDocument();
	});

	test('dismiss calls handleSkip and not the submit handler', async () => {
		const props = defaultProps();
		render(SurveyBanner, { props });

		await user.click(screen.getByRole('button', { name: 'survey.dismiss' }));

		expect(props.handleSkip).toHaveBeenCalledTimes(1);
		expect(props.handleSurveyButtonClick).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/surveys/__tests__/SurveyBanner.test.js`
Expected: FAIL — cannot resolve `../SurveyBanner.svelte`.

- [ ] **Step 3: Create the component**

Create `src/components/surveys/SurveyBanner.svelte`. This is the complete file; Task 4 fills in the body's behavior but the markup below already includes it so the file is written once.

```svelte
<script>
	/**
	 * Compact, collapsible survey banner for the stop pane.
	 *
	 * Owns all presentation state (expanded, answer, error, in-flight) and
	 * delegates the network call to StopPane via handleSurveyButtonClick.
	 *
	 * @typedef {Object} Props
	 * @property {Object} currentStopSurvey - Survey from surveyStore
	 * @property {Function} handleSkip - Dismisses the survey
	 * @property {Function} handleSurveyButtonClick - Awaited; POSTs the hero answer. May reject.
	 * @property {Function} handleHeroQuestionChange - Called with the resolved answer value
	 * @property {number} remainingQuestionsLength - Drives the Submit vs. Next label
	 */
	import { slide } from 'svelte/transition';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCommentDots,
		faChevronDown,
		faChevronUp,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';
	import SurveyQuestion from '$components/surveys/SurveyQuestion.svelte';

	/** @type {Props} */
	let {
		currentStopSurvey,
		handleSkip,
		handleSurveyButtonClick,
		handleHeroQuestionChange,
		remainingQuestionsLength = 0
	} = $props();

	let expanded = $state(false);
	let answer = $state('');
	let showRequiredError = $state(false);
	let submitting = $state(false);
	let submitFailed = $state(false);

	let heroQuestion = $derived(currentStopSurvey?.questions?.[0] ?? null);
	let questionType = $derived(heroQuestion?.content?.type ?? null);

	// `label` questions are informational, so they submit with no answer —
	// this mirrors the exemption in StopPane.handleSurveyButtonClick.
	let needsAnswer = $derived(questionType !== 'label');

	// An `external_survey` question renders a bare link and never fires a change
	// event, so a Submit button here could never do anything but no-op.
	let showSubmit = $derived(questionType !== 'external_survey');

	let hasAnswer = $derived(
		Array.isArray(answer) ? answer.length > 0 : String(answer ?? '').trim() !== ''
	);
	let canSubmit = $derived(!submitting && (!needsAnswer || hasAnswer));

	function handleChange(event) {
		if (questionType === 'checkbox') {
			const option = event.target.value;
			const current = Array.isArray(answer) ? answer : [];
			answer = event.target.checked
				? [...current, option]
				: current.filter((selected) => selected !== option);
		} else {
			answer = event.target.value;
		}

		if (hasAnswer) {
			showRequiredError = false;
		}

		handleHeroQuestionChange(answer);
	}

	async function submit() {
		if (needsAnswer && !hasAnswer) {
			showRequiredError = true;
			return;
		}

		submitting = true;
		submitFailed = false;

		try {
			await handleSurveyButtonClick();
		} catch {
			// StopPane leaves the banner mounted on failure so the user can retry.
			submitFailed = true;
		} finally {
			submitting = false;
		}
	}
</script>

{#if heroQuestion}
	<!-- -mx-4 bleeds to the edges of both containers that host StopPane: the
	     bottom sheet body (px-4) and StandalonePage (p-4). -->
	<div
		class="bg-primary-100 -mx-4 border-y border-gray-200 px-4 dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="flex items-center gap-3 py-3">
			<span
				aria-hidden="true"
				class="bg-brand-accent text-brand-foreground flex h-12 w-12 flex-none items-center justify-center rounded-xl text-xl"
			>
				<FontAwesomeIcon icon={faCommentDots} />
			</span>

			<button
				type="button"
				onclick={() => (expanded = !expanded)}
				aria-expanded={expanded}
				class="flex min-w-0 flex-1 items-center gap-3 text-left"
			>
				<!-- min-w-0 lets these truncate instead of pushing the buttons off-screen. -->
				<span class="min-w-0 flex-1">
					<span class="block truncate font-bold text-gray-900 dark:text-white">
						{currentStopSurvey.name}
					</span>
					<span class="block truncate text-sm text-gray-600 dark:text-gray-300">
						{heroQuestion.content.label_text}
					</span>
				</span>
				<span class="flex-none text-gray-500 dark:text-gray-400">
					<FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
				</span>
				<span class="sr-only">{expanded ? $t('survey.collapse') : $t('survey.expand')}</span>
			</button>

			<button
				type="button"
				onclick={handleSkip}
				aria-label={$t('survey.dismiss')}
				class="flex-none px-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			>
				<FontAwesomeIcon icon={faXmark} />
			</button>
		</div>

		{#if expanded}
			<!-- 300ms matches AccordionItem, so this opens like the arrival rows below it. -->
			<div transition:slide|local={{ duration: 300 }} class="pb-4">
				<SurveyQuestion
					question={heroQuestion}
					index={0}
					value={answer}
					required={heroQuestion.required}
					onInputChange={handleChange}
					variant="compact"
					error={showRequiredError}
				/>

				{#if submitFailed}
					<p class="mt-2 text-sm text-red-600 dark:text-red-400">
						{$t('survey.submit_failed')}
					</p>
				{/if}

				{#if showSubmit}
					<div class="mt-4 flex justify-end">
						<button
							type="button"
							onclick={submit}
							disabled={!canSubmit}
							class="bg-brand-accent text-brand-foreground hover:bg-brand-accent-dark rounded-lg px-6 py-3 text-sm font-semibold shadow transition disabled:cursor-not-allowed disabled:opacity-50"
						>
							{remainingQuestionsLength === 0 ? $t('survey.submit') : $t('survey.next')}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/surveys/__tests__/SurveyBanner.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/surveys/SurveyBanner.svelte src/components/surveys/__tests__/SurveyBanner.test.js
git commit -m "feat(surveys): add collapsible SurveyBanner component"
```

---

### Task 4: Cover the expanded body's behavior

The markup exists from Task 3. This task proves the behavior that markup implies: answer tracking (including checkboxes), the required-error gate, `external_survey` having no Submit button, and in-flight/failure handling.

**Files:**

- Test: `src/components/surveys/__tests__/SurveyBanner.test.js` (extend)
- Modify: `src/components/surveys/SurveyBanner.svelte` (only if a test exposes a defect)

**Interfaces:**

- Consumes: `SurveyBanner` from Task 3.
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/surveys/__tests__/SurveyBanner.test.js`, inside the same file (after the existing `describe` block):

```js
describe('SurveyBanner — expanded', () => {
	let user;

	beforeEach(() => {
		user = userEvent.setup();
	});

	async function renderExpanded(overrides = {}) {
		const props = defaultProps(overrides);
		render(SurveyBanner, { props });
		await user.click(screen.getByRole('button', { name: /survey.expand/ }));
		return props;
	}

	test('submit is disabled until an answer is selected', async () => {
		await renderExpanded();

		const submitButton = screen.getByRole('button', { name: 'survey.submit' });
		expect(submitButton).toBeDisabled();

		await user.click(screen.getByLabelText('Very Easy'));

		expect(submitButton).toBeEnabled();
	});

	test('reports the resolved answer upward, not the event', async () => {
		const props = await renderExpanded();

		await user.click(screen.getByLabelText('Neutral'));

		expect(props.handleHeroQuestionChange).toHaveBeenCalledWith('Neutral');
	});

	test('never shows the required message unprompted', async () => {
		// The disabled Submit button makes the guard in submit() unreachable by
		// clicking, so what is testable here is the regression this redesign
		// fixes: the message must not appear on render, nor on first answer.
		await renderExpanded();

		expect(screen.queryByText('survey.required_answer')).not.toBeInTheDocument();

		await user.click(screen.getByLabelText('Very Easy'));
		expect(screen.queryByText('survey.required_answer')).not.toBeInTheDocument();
	});

	test('checkbox answers accumulate and unchecking removes them', async () => {
		const props = await renderExpanded({
			currentStopSurvey: surveyWithHero({
				type: 'checkbox',
				label_text: 'Which amenities does this stop have?',
				options: ['Shelter', 'Bench', 'Lighting']
			})
		});

		const submitButton = screen.getByRole('button', { name: 'survey.submit' });

		await user.click(screen.getByLabelText('Shelter'));
		await user.click(screen.getByLabelText('Bench'));
		expect(props.handleHeroQuestionChange).toHaveBeenLastCalledWith(['Shelter', 'Bench']);

		await user.click(screen.getByLabelText('Shelter'));
		expect(props.handleHeroQuestionChange).toHaveBeenLastCalledWith(['Bench']);
		expect(submitButton).toBeEnabled();

		await user.click(screen.getByLabelText('Bench'));
		expect(props.handleHeroQuestionChange).toHaveBeenLastCalledWith([]);
		expect(submitButton).toBeDisabled();
	});

	test('a label question can be submitted with no answer', async () => {
		const props = await renderExpanded({
			currentStopSurvey: surveyWithHero(
				{ type: 'label', label_text: 'Thanks for riding with us.' },
				{ required: false }
			)
		});

		const submitButton = screen.getByRole('button', { name: 'survey.submit' });
		expect(submitButton).toBeEnabled();

		await user.click(submitButton);
		expect(props.handleSurveyButtonClick).toHaveBeenCalledTimes(1);
	});

	test('an external_survey question renders a link and no submit button', async () => {
		await renderExpanded({
			currentStopSurvey: surveyWithHero({
				type: 'external_survey',
				label_text: 'Take our rider survey',
				url: 'https://example.com/survey'
			})
		});

		expect(screen.getByRole('link', { name: 'Take our rider survey' })).toHaveAttribute(
			'href',
			'https://example.com/survey'
		);
		expect(screen.queryByRole('button', { name: 'survey.submit' })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'survey.next' })).not.toBeInTheDocument();
	});

	test('reads "next" when the survey has more questions', async () => {
		await renderExpanded({ remainingQuestionsLength: 3 });

		expect(screen.getByRole('button', { name: 'survey.next' })).toBeInTheDocument();
	});

	test('submit is disabled while in flight and the handler is called once', async () => {
		let release;
		const handleSurveyButtonClick = vi.fn(() => new Promise((resolve) => (release = resolve)));
		await renderExpanded({ handleSurveyButtonClick });

		await user.click(screen.getByLabelText('Very Easy'));
		const submitButton = screen.getByRole('button', { name: 'survey.submit' });

		await user.click(submitButton);
		expect(submitButton).toBeDisabled();

		release();
		await vi.waitFor(() => expect(submitButton).toBeEnabled());
		expect(handleSurveyButtonClick).toHaveBeenCalledTimes(1);
	});

	test('a rejected submit shows the failure message and re-enables submit', async () => {
		await renderExpanded({
			handleSurveyButtonClick: vi.fn().mockRejectedValue(new Error('network down'))
		});

		await user.click(screen.getByLabelText('Very Easy'));
		await user.click(screen.getByRole('button', { name: 'survey.submit' }));

		await vi.waitFor(() => expect(screen.getByText('survey.submit_failed')).toBeInTheDocument());
		expect(screen.getByRole('button', { name: 'survey.submit' })).toBeEnabled();
	});
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/components/surveys/__tests__/SurveyBanner.test.js`
Expected: PASS. The Task 3 implementation should already satisfy all of these.

If any fail, the implementation has a real defect — fix `SurveyBanner.svelte`, do not weaken the test. Two likely causes: `hasAnswer` read inside `handleChange` returning a stale value (read `answer` directly instead of the derived), or `submitting` not resetting because the `finally` block was omitted.

- [ ] **Step 3: Commit**

```bash
npm run format
git add src/components/surveys/__tests__/SurveyBanner.test.js src/components/surveys/SurveyBanner.svelte
git commit -m "test(surveys): cover SurveyBanner expanded behavior"
```

---

### Task 5: Wire the banner into `StopPane` and delete `HeroQuestion`

Four `StopPane` changes ride along because the banner's contract requires them: the answer handler takes a value instead of an event, the emptiness guard must handle arrays, the submit path needs error handling, and the question count must be derived at render time rather than read from state that is empty until submit runs.

**Files:**

- Modify: `src/components/stops/StopPane.svelte` (imports at :14, handlers at :226-267, markup at :337-345)
- Delete: `src/components/surveys/HeroQuestion.svelte`
- Modify: `src/components/stops/__tests__/StopPane.test.js:61`

**Interfaces:**

- Consumes: `SurveyBanner` from Task 3 — `handleSurveyButtonClick` is awaited and may reject; `handleHeroQuestionChange` receives a `string` or `string[]`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Repoint the test mock**

In `src/components/stops/__tests__/StopPane.test.js`, replace lines 61-67:

```js
vi.mock('$components/surveys/HeroQuestion.svelte', () => ({
```

with:

```js
vi.mock('$components/surveys/SurveyBanner.svelte', () => ({
```

Leave the rest of that mock block unchanged.

- [ ] **Step 2: Run the StopPane tests to verify they fail**

Run: `npx vitest run src/components/stops/__tests__/StopPane.test.js`

Expected: FAIL. `StopPane` still imports `HeroQuestion.svelte`, which is no longer mocked, so the real component renders in the tests after line 494 (where the `surveyStore` mock is overwritten to emit a survey — `vi.clearAllMocks()` clears calls but not implementations). The `component accessibility features` test at line 507 should fail on the `h2` count, since `HeroQuestion.svelte:20` renders one.

- [ ] **Step 3: Swap the import**

In `src/components/stops/StopPane.svelte`, replace line 14:

```svelte
import HeroQuestion from '$components/surveys/HeroQuestion.svelte';
```

with:

```svelte
import SurveyBanner from '$components/surveys/SurveyBanner.svelte';
```

- [ ] **Step 4: Update the handlers**

In `src/components/stops/StopPane.svelte`, replace the whole of `handleSurveyButtonClick` and `handleHeroQuestionChange` (lines 226-267, ending just before the `$effect`) with:

```svelte
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
```

Note this also moves `showSurveyModal.set(true)` and `nextSurveyQuestion = true` to _after_ the successful POST — previously the modal opened before the network call, so a failed submit left the modal open over a survey that was never recorded.

- [ ] **Step 5: Update the markup**

In `src/components/stops/StopPane.svelte`, replace lines 337-345:

```svelte
{#if showHeroQuestion && currentStopSurvey}
	<HeroQuestion
		{currentStopSurvey}
		{handleSkip}
		{handleSurveyButtonClick}
		{handleHeroQuestionChange}
		remainingQuestionsLength={remainingSurveyQuestions.length}
	/>
{/if}
```

with:

```svelte
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
```

`remainingSurveyQuestions` is only assigned inside `handleSurveyButtonClick`, so reading its length at render time always yielded `0` and the "Next" label was unreachable.

- [ ] **Step 6: Delete the old component**

```bash
git rm src/components/surveys/HeroQuestion.svelte
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/components/stops/__tests__/StopPane.test.js src/components/surveys/__tests__/`
Expected: PASS.

Then confirm nothing else referenced the deleted file:

Run: `grep -rn "HeroQuestion" src/ || echo "no references"`
Expected: prints `no references`.

- [ ] **Step 8: Commit**

```bash
npm run format
git add -A src/components/stops/StopPane.svelte src/components/stops/__tests__/StopPane.test.js src/components/surveys/HeroQuestion.svelte
git commit -m "feat(surveys): replace hero question card with SurveyBanner

Also fixes three latent bugs in the path: checkbox answers were reduced
to the last-clicked option, the Next label was unreachable because the
question count was read from state that is empty until submit, and a
failed submit opened the follow-up modal anyway."
```

---

### Task 6: Make the banner sit flush with the arrivals list

`StopPane.svelte:299` wraps the pane contents in `space-y-4`, which puts a 16px gap between the banner and the arrival rows. The banner has to be flush, so the blanket spacing is replaced with explicit margins on the children that still want them.

**Files:**

- Modify: `src/components/stops/StopPane.svelte:299`, and the children inside that wrapper

**Interfaces:**

- Consumes: `SurveyBanner` wired up in Task 5.
- Produces: nothing.

- [ ] **Step 1: Replace the blanket spacing**

In `src/components/stops/StopPane.svelte`, line 299, change:

```svelte
			<div class="space-y-4">
```

to:

```svelte
			<!-- No space-y here: the survey banner and the arrivals list must sit
			     flush against each other. Spacing is applied per-child instead. -->
			<div>
```

- [ ] **Step 2: Add spacing back to the children that need it**

Still in `src/components/stops/StopPane.svelte`:

1. The hero-card block — change the opening tag at line 301 from `<div>` to `<div class="mb-4">`.
2. The `ServiceAlerts` block — wrap it so it keeps its gap:

```svelte
{#if serviceAlerts}
	<div class="mb-4">
		<ServiceAlerts bind:serviceAlerts stopId={stop.id} routeIds={stop.routeIds ?? []} />
	</div>
{/if}
```

3. The empty-results block — change `<div class="flex flex-col items-center justify-center gap-3">` to `<div class="mt-4 flex flex-col items-center justify-center gap-3">`.
4. The load-more container after the accordion — change `<div class="flex justify-center">` to `<div class="mt-4 flex justify-center">`.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS. Coverage thresholds are 70% for branches, functions, lines, and statements.

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`, open a stop that has an active survey, and confirm against the mockups:

- the banner is collapsed by default, bleeds to the sheet edges, and its bottom rule sits directly above the first arrival row with no gap
- the chevron expands it with a slide, matching the arrival rows' feel
- Submit is muted until an option is selected
- `×` dismisses it
- the same checks on `/stops/<stopID>` directly, where the banner bleeds to the `max-w-5xl` edge
- both light and dark mode

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/stops/StopPane.svelte
git commit -m "style(stops): sit the survey banner flush with the arrivals list"
```

---

## Self-Review Notes

Spec coverage check — every spec section maps to a task:

| Spec section                                          | Task                         |
| ----------------------------------------------------- | ---------------------------- |
| Render guard (empty `questions`)                      | 3                            |
| Collapsed layout, no headings, `aria-hidden` tile     | 3                            |
| Expanded layout, `transition:slide`                   | 3                            |
| Spacing / removing `space-y-4`                        | 6                            |
| Full-bleed constraint                                 | 3 (markup), 6 (verification) |
| State ownership, `handleHeroQuestionChange` signature | 3, 5                         |
| `SurveyQuestion` error self-assignment                | 1                            |
| `{#key stop.id}`                                      | 5                            |
| Submit failure, double-submit                         | 3, 4, 5                      |
| Dismiss                                               | 3, 5                         |
| Question-type table                                   | 3, 4                         |
| Error state                                           | 3, 4                         |
| Theming (`bg-primary-100`)                            | 3                            |
| Accessibility (no `aria-controls`, no Escape binding) | 3                            |
| i18n keys                                             | 1, 2                         |
| Testing                                               | 1, 3, 4, 5                   |
| `remainingQuestionsLength` derivation                 | 5                            |

Known deviation: the spec's test list includes "Submit with a required question unanswered shows the required message." Because the Submit button is `disabled` until an answer exists, that path is not reachable by clicking in a jsdom test — the guard in `submit()` is defense in depth. Task 4 asserts the message is absent on first render and stays absent while answering, which is the reachable half of that requirement.
