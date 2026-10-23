<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { locale, t } from 'svelte-i18n';
	import * as InputGroup from '$components/ui/input-group';
	import * as Popover from '$components/ui/popover';
	import { Calendar } from '$components/ui/calendar';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		firstDayOfWeek = 0,
		id,
		inputClass,
		value = $bindable()
	}: {
		class?: string;
		firstDayOfWeek?: ComponentProps<typeof Calendar>['weekStartsOn'];
		id?: string;
		inputClass?: string;
		// Local midnight of the picked day.
		value: Date;
	} = $props();

	function toCalendarDate(date: Date): CalendarDate {
		return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
	}

	function formatDate(date: Date, localeCode: string | null | undefined) {
		return date.toLocaleDateString(localeCode ?? undefined, {
			day: '2-digit',
			month: 'long',
			year: 'numeric'
		});
	}

	function selectCalendarDate(date: DateValue | undefined) {
		// Undefined only on deselect, which `preventDeselect` rules out.
		if (date) value = new Date(date.year, date.month - 1, date.day);
	}

	// Typed dates are applied on change (blur or Enter), not per keystroke, so a
	// partial entry that happens to parse doesn't commit a date or get reformatted
	// out from under the user.
	function commitInput() {
		const date = new Date(inputValue);
		if (inputValue && !isNaN(date.getTime())) {
			value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
			month = toCalendarDate(value);
		}
		// Shows the committed date in the canonical format, or restores it after
		// an entry that didn't parse.
		inputValue = formatDate(value, $locale);
	}

	let open = $state(false);
	const calendarValue = $derived(toCalendarDate(value));
	// Overridden as the user types or pages through months, and reset whenever
	// the value changes.
	let inputValue = $derived(formatDate(value, $locale));
	let month = $derived<DateValue | undefined>(calendarValue);
</script>

<InputGroup.Root class={className}>
	<InputGroup.Input
		{id}
		aria-label={$t('date_picker.date')}
		class={inputClass}
		bind:value={inputValue}
		onchange={commitInput}
		onkeydown={(e) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				open = true;
			}
		}}
	/>
	<InputGroup.Addon align="inline-end">
		<Popover.Root bind:open>
			<Popover.Trigger>
				{#snippet child({ props })}
					<InputGroup.Button
						{...props}
						variant="ghost"
						size="icon-xs"
						aria-label={$t('date_picker.choose_date')}
					>
						<CalendarIcon />
					</InputGroup.Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content
				class="w-auto overflow-hidden p-0"
				align="end"
				alignOffset={-8}
				sideOffset={10}
			>
				<Calendar
					type="single"
					locale={$locale ?? undefined}
					preventDeselect
					weekStartsOn={firstDayOfWeek}
					bind:value={() => calendarValue, selectCalendarDate}
					bind:placeholder={() => month, (v) => (month = v)}
					onValueChange={() => {
						open = false;
					}}
				/>
			</Popover.Content>
		</Popover.Root>
	</InputGroup.Addon>
</InputGroup.Root>
