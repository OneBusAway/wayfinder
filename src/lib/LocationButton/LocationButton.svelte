<script>
	import { onMount } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faLocationCrosshairs } from '@fortawesome/free-solid-svg-icons';
	import { t } from 'svelte-i18n';

	let { handleLocationObtained } = $props();

	let button = $state();

	function handleClick() {
		if (!navigator.geolocation) {
			alert('Geolocation is not supported by this browser.');
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { latitude, longitude } = position.coords;
				handleLocationObtained(latitude, longitude);
			},
			() => {
				alert('Unable to retrieve your location.');
			}
		);
	}

	onMount(() => {
		button.addEventListener('click', handleClick);
	});
</script>

<button
	bind:this={button}
	class="custom-map-control-button"
	aria-label={$t('map.find_my_location')}
>
	<FontAwesomeIcon icon={faLocationCrosshairs} />
</button>

<style>
	.custom-map-control-button {
		background-color: #fff;
		border: 0;
		border-radius: 2px;
		box-shadow: 0 1px 4px -1px rgba(0, 0, 0, 0.3);
		margin: 10px;
		padding: 0 0.3em;
		font-size: 25px;
		color: #666;
		overflow: hidden;
		height: 40px;
		cursor: pointer;
		position: absolute;
		bottom: 4em;
		right: 0;
		z-index: 5;
	}
	.custom-map-control-button:hover {
		background: rgb(235, 235, 235);
		color: black;
	}
</style>
