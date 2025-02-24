<script>
	let { message = 'Thank you for taking the survey!' } = $props();
</script>

<div class="flex flex-1 flex-col items-center justify-center p-12">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-20 w-20 text-green-500"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
	</svg>
	<h2 class="mt-6 text-4xl font-bold text-gray-900 dark:text-white">Survey Submitted</h2>
	<p class="mt-3 text-xl text-gray-700 dark:text-gray-300">
		{message}
	</p>
</div>
