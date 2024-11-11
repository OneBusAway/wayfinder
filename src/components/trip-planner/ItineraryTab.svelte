<script>
	export let index;
	export let activeTab;
	export let setActiveTab;
</script>

<button
	class={`-mb-px px-4 py-2 font-semibold ${
		activeTab === index ? 'border-b-2 border-green-500 text-green-500' : 'text-gray-500'
	}`}
	on:click={() => setActiveTab(index)}
>
	Itinerary {index + 1}
</button>
