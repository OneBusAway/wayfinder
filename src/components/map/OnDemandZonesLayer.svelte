<!--
    @component
    Renderless: draws on-demand zones for the current viewport. Region level
    fills zones and opens a service on click; street level strokes them with a
    halo and leaves clicks to stops and the map; zoomed further out, nothing is
    fetched or drawn. Only active in the map's normal mode.

    @prop {import('$lib/types').MapProvider | null} mapProvider
    @prop {boolean} active - false outside normal map mode
    @prop {number} viewportTick - bumped by MapView each time the map settles
-->
<script>
	import { onDestroy, untrack } from 'svelte';
	import { onDemandState, fetchServicesForViewport } from '$lib/onDemand/onDemandState.svelte.js';
	import { zoneLevel, zoneStyle } from '$lib/onDemand/zones.js';
	import { assignZoneColors } from '$lib/onDemand/colors.js';
	import { drawableAreas } from '$lib/onDemand/models.js';
	import { openOnDemandService } from '$lib/onDemand/navigation.js';

	let { mapProvider = null, active = true, viewportTick = 0 } = $props();

	let services = $state.raw([]);
	let level = $state('hidden');
	/** @type {Map<string, { handles: any[], level: string }>} */
	const drawn = new Map();
	let requestSeq = 0;

	let isEnabled = $derived(active && onDemandState.support !== 'unsupported');

	$effect(() => {
		viewportTick;
		const provider = mapProvider;
		if (!provider || !isEnabled) {
			requestSeq++;
			services = [];
			level = 'hidden';
			return;
		}
		untrack(() => refresh(provider));
	});

	$effect(() => {
		const provider = mapProvider;
		const highlighted = onDemandState.highlighted;
		const visible = isEnabled ? services : [];
		const currentLevel = level;
		if (!provider) return;
		untrack(() => draw(provider, visible, currentLevel, isEnabled ? highlighted : null));
	});

	onDestroy(() => {
		if (mapProvider) clearDrawn(mapProvider);
	});

	async function refresh(provider) {
		const bounds = provider.getBoundingBox();
		const nextLevel = bounds ? zoneLevel(bounds) : 'hidden';
		const seq = ++requestSeq;
		if (nextLevel === 'hidden') {
			level = 'hidden';
			services = [];
			return;
		}
		const result = await fetchServicesForViewport({
			lat: (bounds.north + bounds.south) / 2,
			lon: (bounds.east + bounds.west) / 2,
			latSpan: bounds.north - bounds.south,
			lonSpan: bounds.east - bounds.west
		});
		if (seq !== requestSeq) return;
		level = nextLevel;
		// A failed fetch keeps the last zones rather than blinking them off; an unsupported
		// verdict clears them through isEnabled instead.
		if (result) services = result.services;
	}

	// The highlighted service stays drawn even when this viewport's fetch
	// didn't return it, or the map is zoomed past region level.
	function servicesToDraw(visible, highlighted) {
		if (!highlighted || visible.some((service) => service.id === highlighted.id)) return visible;
		return [...visible, highlighted];
	}

	function highlightFor(service, highlighted) {
		if (!highlighted) return 'none';
		if (service.id === highlighted.id) return 'selected';
		return 'dimmed';
	}

	function draw(provider, visible, currentLevel, highlighted) {
		const list = servicesToDraw(currentLevel === 'hidden' ? [] : visible, highlighted);
		const drawLevel = currentLevel === 'street' ? 'street' : 'region';
		const colors = assignZoneColors(list);
		const keep = new Set(list.map((service) => service.id));

		for (const [id, entry] of drawn) {
			if (!keep.has(id) || entry.level !== drawLevel) {
				entry.handles.forEach((handle) => provider.removePolygon(handle));
				drawn.delete(id);
			}
		}

		for (const service of list) {
			const highlight = highlightFor(service, highlighted);
			const style = zoneStyle({ level: drawLevel, color: colors.get(service.id), highlight });
			const existing = drawn.get(service.id);
			if (existing) {
				existing.handles.forEach((handle) => provider.setPolygonStyle(handle, style));
				continue;
			}
			const handles = drawableAreas(service)
				.map((area) =>
					provider.createPolygon(area.geometry, {
						...style,
						onClick: () => openOnDemandService(service.id)
					})
				)
				.filter(Boolean);
			drawn.set(service.id, { handles, level: drawLevel });
		}
	}

	function clearDrawn(provider) {
		for (const entry of drawn.values())
			entry.handles.forEach((handle) => provider.removePolygon(handle));
		drawn.clear();
	}
</script>
