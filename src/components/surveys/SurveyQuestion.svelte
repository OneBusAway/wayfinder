<script lang="ts">
	import { Button } from '$components/ui/button';
	import { Checkbox } from '$components/ui/checkbox';
	import { Input } from '$components/ui/input';
	import * as RadioGroup from '$components/ui/radio-group';
	import { cn } from '$lib/utils/shadcn.js';
	import { t } from 'svelte-i18n';

	import type { SurveyAnswer, SurveyQuestion } from '$stores/surveyStore';

	interface Props {
		error?: boolean;
		/** Receives the question's whole new answer after every change. */
		onInputChange: (answer: SurveyAnswer) => void;
		question: SurveyQuestion;
		required?: boolean;
		value?: SurveyAnswer;
		variant?: 'compact' | 'default';
	}

	let {
		error,
		onInputChange,
		question,
		required,
		value = '',
		variant = 'default'
	}: Props = $props();

	const id = $props.id();
	const errorId = `${id}-error`;

	let type = $derived(question.content.type);
	let selected = $derived(Array.isArray(value) ? value : []);

	let compact = $derived(variant === 'compact');
	let titleClass = $derived(cn('font-medium text-foreground', compact ? 'text-sm' : 'text-base'));
	// The Shadcn Checkbox and RadioGroupItem default to size-4, which is small
	// for the modal's full-width questions.
	let controlClass = $derived(compact ? undefined : 'size-5');
	let optionLabelClass = $derived(cn('text-foreground', compact ? 'text-sm' : 'text-base'));

	// `error` is owned by the parent. This component never decides on its own
	// that an answer is missing — it only reports the change upward.
	function toggleOption(option: string, checked: boolean) {
		onInputChange(checked ? [...selected, option] : selected.filter((o) => o !== option));
	}
</script>

{#snippet title()}
	{question.content.label_text}
	{#if required}
		<span class="text-destructive" aria-label={$t('survey.required_question')}>*</span>
	{/if}
{/snippet}

<div class="flex flex-col gap-3">
	{#if type === 'text'}
		<label for="{id}-input" class={titleClass}>{@render title()}</label>
		<Input
			id="{id}-input"
			value={typeof value === 'string' ? value : ''}
			placeholder="Type your answer..."
			aria-invalid={error || undefined}
			aria-describedby={error ? errorId : undefined}
			oninput={(e) => onInputChange(e.currentTarget.value)}
		/>
	{:else if type === 'radio'}
		<p id="{id}-title" class={titleClass}>{@render title()}</p>
		<RadioGroup.Root
			value={typeof value === 'string' ? value : ''}
			onValueChange={onInputChange}
			aria-labelledby="{id}-title"
			aria-invalid={error || undefined}
			aria-describedby={error ? errorId : undefined}
		>
			{#each question.content.options ?? [] as option, i (option)}
				<div class="flex items-center gap-2">
					<RadioGroup.Item
						id="{id}-{i}"
						value={option}
						aria-invalid={error || undefined}
						class={controlClass}
					/>
					<label for="{id}-{i}" class={optionLabelClass}>{option}</label>
				</div>
			{/each}
		</RadioGroup.Root>
	{:else if type === 'checkbox'}
		<fieldset class="flex flex-col gap-3" aria-describedby={error ? errorId : undefined}>
			<legend class={cn(titleClass, 'mb-3')}>{@render title()}</legend>
			{#each question.content.options ?? [] as option, i (option)}
				<div class="flex items-center gap-2">
					<Checkbox
						id="{id}-{i}"
						checked={selected.includes(option)}
						onCheckedChange={(checked) => toggleOption(option, checked)}
						aria-invalid={error || undefined}
						class={controlClass}
					/>
					<label for="{id}-{i}" class={optionLabelClass}>{option}</label>
				</div>
			{/each}
		</fieldset>
	{:else if type === 'label'}
		<p class={titleClass}>{question.content.label_text}</p>
	{:else if type === 'external_survey'}
		<div class="flex flex-col items-start gap-1">
			<Button
				variant="link"
				href={question.content.url}
				target="_blank"
				rel="noopener noreferrer"
				class="h-auto p-0"
			>
				{question.content.label_text}
			</Button>
			{#if question.content.survey_provider}
				<p class="text-sm text-muted-foreground">
					Powered by {question.content.survey_provider}
				</p>
			{/if}
		</div>
	{/if}

	{#if error && type !== 'label'}
		<p id={errorId} class="text-sm text-destructive">{$t('survey.required_answer')}</p>
	{/if}
</div>
