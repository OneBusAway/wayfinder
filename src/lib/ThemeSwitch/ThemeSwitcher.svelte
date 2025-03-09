<script lang="ts">
	import { browser } from '$app/environment';
	let darkMode = true;

	function handleThemeSwitch() {
		darkMode = !darkMode;

		darkMode
			? document.documentElement.classList.add('dark')
			: document.documentElement.classList.remove('dark');

		localStorage.theme = darkMode ? 'dark' : 'light';

		const event = new CustomEvent('themeChange', { detail: { darkMode } });
		window.dispatchEvent(event);
	}

	if (browser) {
		if (
			localStorage.theme === 'dark' ||
			(!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
		) {
			document.documentElement.classList.add('dark');
			darkMode = true;
		} else {
			document.documentElement.classList.remove('dark');
			darkMode = false;
		}

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
			checked={darkMode}
			onclick={handleThemeSwitch}
			aria-label="Toggle theme"
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
</style>
