<script>
	import { Radio, Checkbox, Input } from 'flowbite-svelte';
	import { t } from 'svelte-i18n';
	let {
		question,
		required,
		index,
		value = $bindable(''),
		onInputChange,
		variant = 'default',
		error
	} = $props();

	const baseClasses = {
		label: `relative block font-semibold tracking-tight text-gray-900 dark:text-gray-100`,
		input: `w-full rounded border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100`,
		option: `rounded font-medium text-gray-800 transition-all hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700`
	};

	const sizeClasses = {
		label: variant === 'compact' ? 'mb-2 text-xl' : 'mb-4 text-2xl',
		input: variant === 'compact' ? 'mt-1 px-3 py-2 text-lg' : 'mt-2 px-5 py-4 text-xl',
		option: variant === 'compact' ? 'p-1 text-lg' : 'p-2 text-lg'
	};

	const errorClasses = {
		label: variant === 'compact' ? 'text-red-500' : 'text-xl text-red-500'
	};

	function handleInput(event) {
		onInputChange(event, question, index);
		error = required && (!value || (Array.isArray(value) && value.length === 0));
	}
</script>

<label class={`${baseClasses.label} ${sizeClasses.label}`} for="question-{index}">
	{#if question.content.type !== 'label'}
		{question.content.label_text}
	{/if}
	{#if required && question.content.type !== 'label'}
		<span class="ml-1 text-red-500" aria-label={$t('survey.required_question')}>*</span>
	{/if}
</label>

{#if question.content.type === 'text'}
	<Input
		id="question-{index}"
		type="text"
		{value}
		placeholder="Type your answer..."
		oninput={handleInput}
		class={`${baseClasses.input} ${sizeClasses.input} ${error ? 'border-red-500' : ''}`}
	/>
{:else if question.content.type === 'radio'}
	<div class={`mt-2 space-y-${variant === 'compact' ? '0' : '2'}`}>
		{#each question.content.options as option}
			<Radio
				name="radio-{index}"
				value={option}
				group={value}
				onchange={handleInput}
				class={`${baseClasses.option} ${sizeClasses.option}`}
			>
				{option}
			</Radio>
		{/each}
	</div>
{:else if question.content.type === 'checkbox'}
	<div class={`mt-2 space-y-${variant === 'compact' ? '0' : '2'}`}>
		{#each question.content.options as option}
			<Checkbox
				name="checkbox-{index}"
				value={option}
				checked={value?.includes(option)}
				onchange={handleInput}
				class={`${baseClasses.option} ${sizeClasses.option}`}
			>
				{option}
			</Checkbox>
		{/each}
	</div>
{:else if question.content.type === 'label'}
	<p class={`${sizeClasses.label} text-semibold mt-4 font-bold dark:text-white`}>
		{question.content.label_text}
	</p>
{:else if question.content.type === 'external_survey'}
	<div class="mt-4">
		<a
			href={question.content.url}
			target="_blank"
			rel="noopener noreferrer"
			class="inline-block text-xl font-semibold text-blue-500 underline transition-all hover:text-blue-600"
		>
			{question.content.label_text}
		</a>
		{#if question.content.survey_provider}
			<p class="mt-1 text-gray-500">
				Powered by {question.content.survey_provider}
			</p>
		{/if}
	</div>
{/if}

{#if error && question.content.type !== 'label'}
	<p class={`${errorClasses.label} mt-4`}>This question is required.</p>
{/if}
