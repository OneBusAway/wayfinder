<script lang="ts">
	import { browser } from '$app/environment';
	let darkMode = true;

	function handleThemeSwitch() {
		darkMode = !darkMode;

		darkMode
			? document.documentElement.classList.add('dark')
			: document.documentElement.classList.remove('dark');

		// Update theme in localStorage
		if (browser) {
			localStorage.theme = darkMode ? 'dark' : 'light';
		}

		// Dispatch a themeChange event
		const event = new CustomEvent('themeChange', { detail: { darkMode } });
		window.dispatchEvent(event);
	}

	// Check and apply the theme on the first load
	if (browser) {
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			document.documentElement.classList.add('dark');
			darkMode = true;
		} else {
			document.documentElement.classList.remove('dark');
			darkMode = false;
		}

		// Dispatch the initial themeChange event
		const event = new CustomEvent('themeChange', { detail: { darkMode } });
		window.dispatchEvent(event);
	}
</script>

<div>
	<div class="relative">
		<input
			type="checkbox"
			id="theme-toggle"
			class="sr-only"
			bind:checked={darkMode}
			on:click={handleThemeSwitch}
		/>
		<label
			for="theme-toggle"
			class="relative block h-8 w-14 cursor-pointer rounded-full bg-gray-300 dark:bg-gray-600"
		>
			<span
				class="dot absolute left-1 top-1 h-6 w-6 transform rounded-full bg-white transition dark:translate-x-6"
			></span>
		</label>
	</div>
</div>

<style lang="postcss">
	/* Additional styling if needed */
</style>
