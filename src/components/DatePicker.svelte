<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { CalendarDate, getLocalTimeZone, today, type DateValue } from '@internationalized/date';
	import { DateField } from 'bits-ui';
	import { locale, t } from 'svelte-i18n';
	import * as InputGroup from '$components/ui/input-group';
	import * as Popover from '$components/ui/popover';
	import { Button } from '$components/ui/button';
	import { Calendar } from '$components/ui/calendar';
	import { cn } from '$lib/utils/shadcn.js';
	import { onDestroy, type ComponentProps } from 'svelte';

	let {
		class: className,
		id,
		inputClass,
		value = $bindable(),
		weekStartsOn = 0
	}: {
		class?: string;
		id?: string;
		inputClass?: string;
		// Local midnight of the picked day.
		value: Date;
		weekStartsOn?: ComponentProps<typeof Calendar>['weekStartsOn'];
	} = $props();

	function toCalendarDate(date: Date): CalendarDate {
		return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
	}

	function selectDate(date: DateValue | undefined) {
		if (date && date.compare(calendarValue) !== 0) {
			value = new Date(date.year, date.month - 1, date.day);
		}
	}

	// Long enough to type the next digit, short enough that stepping with the
	// arrow keys feels immediate.
	const COMMIT_DELAY_MS = 500;
	let commitTimer: ReturnType<typeof setTimeout> | undefined;

	// The field changes its value on every keystroke, passing through dates the
	// user didn't mean while typing (2026 visits 0002, 0020 and 0202). A year
	// before 1000 is one still being typed, and the field reports a date with a
	// cleared segment as undefined.
	function isComplete(date: DateValue | undefined): date is DateValue {
		return date !== undefined && date.year >= 1000;
	}

	// Arrow keys and typing both settle on the date the user means, so a complete
	// date is selected once it stops changing.
	function setFieldValue(date: DateValue | undefined) {
		fieldValue = date;
		clearTimeout(commitTimer);
		if (isComplete(date)) commitTimer = setTimeout(commitField, COMMIT_DELAY_MS);
	}

	// Focus leaving the field or Enter selects its date without waiting, or
	// replaces an incomplete one with the selected date.
	function commitField() {
		clearTimeout(commitTimer);
		if (isComplete(fieldValue)) selectDate(fieldValue);
		else fieldValue = toCalendarDate(value);
	}

	onDestroy(() => clearTimeout(commitTimer));

	let open = $state(false);
	const calendarValue = $derived(toCalendarDate(value));

	// Overridden as the user pages through months, and reset whenever the value
	// changes.
	let month = $derived<DateValue | undefined>(calendarValue);
	$effect(() => {
		// Reopening the popover shows the month of the selected date.
		if (open) month = calendarValue;
	});

	// Overridden as the user types, and reset whenever the value changes.
	let fieldValue = $derived<DateValue | undefined>(calendarValue);
</script>

<DateField.Root locale={$locale ?? undefined} bind:value={() => fieldValue, setFieldValue}>
	<InputGroup.Root class={className}>
		<DateField.Input
			{id}
			aria-label={$t('date_picker.date')}
			onfocusout={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitField();
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter') commitField();
			}}
			class={cn(
				'flex flex-1 items-center self-stretch px-4 text-base text-foreground md:text-sm',
				inputClass
			)}
		>
			{#snippet children({ segments })}
				{#each segments as { part, value: segmentValue }, i (i)}
					<!-- The control slot gives the group its focus ring. -->
					<DateField.Segment
						{part}
						data-slot="input-group-control"
						class="rounded-sm px-0.5 tabular-nums outline-none focus:bg-accent focus:text-accent-foreground data-[segment=literal]:px-0 data-[segment=literal]:text-muted-foreground"
					>
						{segmentValue}
					</DateField.Segment>
				{/each}
			{/snippet}
		</DateField.Input>
		<InputGroup.Addon align="inline-end">
			<Popover.Root bind:open>
				<Popover.Trigger>
					{#snippet child({ props })}
						<InputGroup.Button
							{...props}
							variant="ghost"
							size="icon-sm"
							aria-label={$t('date_picker.choose_date')}
						>
							<CalendarIcon />
						</InputGroup.Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content
					class="z-[10000] w-auto overflow-hidden p-0"
					align="end"
					alignOffset={-8}
					sideOffset={10}
				>
					<Calendar
						type="single"
						locale={$locale ?? undefined}
						preventDeselect
						{weekStartsOn}
						bind:value={() => calendarValue, selectDate}
						bind:placeholder={() => month, (v) => (month = v)}
						onValueChange={() => {
							open = false;
						}}
					/>
					<div class="flex justify-center border-t p-2">
						<!-- The day the calendar marks as today, which is in the device's time zone. -->
						<Button
							size="sm"
							variant="outline"
							onclick={() => {
								selectDate(today(getLocalTimeZone()));
								open = false;
							}}
						>
							{$t('trip-planner.today')}
						</Button>
					</div>
				</Popover.Content>
			</Popover.Root>
		</InputGroup.Addon>
	</InputGroup.Root>
</DateField.Root>
