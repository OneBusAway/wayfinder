<script>
	/** Minimal stub so tests can assert Tailwind `class` passed from parents (e.g. CompassArrow). */
	let { class: klass = '' } = $props();
</script>

<svg data-testid="fontawesome-mock" class={klass} role="img" aria-hidden="true"></svg>
