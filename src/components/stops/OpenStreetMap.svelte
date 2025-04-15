<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	/**
	 * @typedef {Object} Props
	 * @property {number} lat - Latitude of the stop
	 * @property {number} lon - Longitude of the stop
	 * @property {string} name - Name of the stop
	 * @property {boolean} [showControls=true] - Whether to show map controls
	 * @property {number} [zoom=15] - Initial zoom level of the map
	 */
	/** @type {Props} */
	let { lat, lon, name, showControls = true, zoom = 15 } = $props();

	let mapElement;
	let isDarkMode = false;
	let mapInitialized = false;
	let currentZoom = zoom;
	let dragStartX = 0;
	let dragStartY = 0;
	let isDragging = false;
	let centerX = 0;
	let centerY = 0;
	let canvasWidth = 0;
	let canvasHeight = 0;

	let mapCenterLat = lat;
	let mapCenterLon = lon;

	// OSM tile server URL template as using for other pages
	const tileServerLight = 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
	const tileServerDark = 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

	const tileCache = new Map();

	function latLonToXY(lat, lon, zoom) {
		const n = Math.pow(2, zoom);
		const x = ((lon + 180) / 360) * n;
		const latRad = (lat * Math.PI) / 180;
		const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
		return { x, y };
	}

	function xyToLatLon(x, y, zoom) {
		const n = Math.pow(2, zoom);
		const lon = (x / n) * 360 - 180;
		const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
		const lat = (latRad * 180) / Math.PI;
		return { lat, lon };
	}

	function calculateMarkerPosition(markerLat, markerLon, centerLat, centerLon, zoom) {
		const centerPoint = latLonToXY(centerLat, centerLon, zoom);
		const markerPoint = latLonToXY(markerLat, markerLon, zoom);

		const tileSize = 256;
		const pixelX = (markerPoint.x - centerPoint.x) * tileSize;
		const pixelY = (markerPoint.y - centerPoint.y) * tileSize;

		return {
			x: canvasWidth / 2 + pixelX,
			y: canvasHeight / 2 + pixelY
		};
	}

	// Refresh the map display
	function refreshMap() {
		if (!mapElement || !browser || !mapInitialized) return;

		const ctx = mapElement.getContext('2d');
		if (!ctx) return;

		// Clear the canvas
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		const center = latLonToXY(mapCenterLat, mapCenterLon, currentZoom);
		centerX = center.x;
		centerY = center.y;

		const tileSize = 256;

		const tilesInViewX = Math.ceil(canvasWidth / tileSize) + 1;
		const tilesInViewY = Math.ceil(canvasHeight / tileSize) + 1;

		const centerTileX = Math.floor(centerX);
		const centerTileY = Math.floor(centerY);

		const startTileX = centerTileX - Math.floor(tilesInViewX / 2);
		const startTileY = centerTileY - Math.floor(tilesInViewY / 2);

		const offsetX = (centerX - Math.floor(centerX)) * tileSize;
		const offsetY = (centerY - Math.floor(centerY)) * tileSize;

		ctx.fillStyle = isDarkMode ? '#242424' : '#f8f9fa';
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		for (let y = 0; y < tilesInViewY; y++) {
			for (let x = 0; x < tilesInViewX; x++) {
				const tileX = startTileX + x;
				const tileY = startTileY + y;

				if (
					tileX < 0 ||
					tileY < 0 ||
					tileX >= Math.pow(2, currentZoom) ||
					tileY >= Math.pow(2, currentZoom)
				) {
					continue;
				}

				const drawX = Math.round(
					canvasWidth / 2 - offsetX + (x - Math.floor(tilesInViewX / 2)) * tileSize
				);
				const drawY = Math.round(
					canvasHeight / 2 - offsetY + (y - Math.floor(tilesInViewY / 2)) * tileSize
				);

				drawTile(ctx, tileX, tileY, currentZoom, drawX, drawY);
			}
		}

		ctx.fillStyle = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
		ctx.font = '10px Arial';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'bottom';
		ctx.fillText('© wayfinder contributors ', canvasWidth - 5, canvasHeight - 5);

		const markerPos = calculateMarkerPosition(lat, lon, mapCenterLat, mapCenterLon, currentZoom);

		if (isFinite(markerPos.x) && isFinite(markerPos.y)) {
			drawMarker(ctx, markerPos.x, markerPos.y);
		}

		if (showControls) {
			drawControls(ctx);
		}
	}

	function drawMarker(ctx, markerX, markerY) {
		if (
			markerX < -50 ||
			markerX > canvasWidth + 50 ||
			markerY < -50 ||
			markerY > canvasHeight + 50
		) {
			return;
		}

		const markerSize = 24;

		ctx.save();

		ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
		ctx.beginPath();
		ctx.ellipse(markerX, markerY + 2, markerSize / 4, markerSize / 6, 0, 0, Math.PI * 2);
		ctx.fill();

		const stemWidth = markerSize / 6;
		const stemHeight = markerSize / 2;
		const pinTop = markerY - stemHeight;

		ctx.fillStyle = '#e74c3c';
		ctx.beginPath();
		ctx.moveTo(markerX - stemWidth, pinTop);
		ctx.lineTo(markerX + stemWidth, pinTop);
		ctx.lineTo(markerX, markerY);
		ctx.closePath();
		ctx.fill();

		// Draw pin head
		ctx.beginPath();
		ctx.arc(markerX, pinTop, markerSize / 3, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = isDarkMode ? '#333333' : '#ffffff';
		ctx.beginPath();
		ctx.arc(markerX, pinTop, markerSize / 6, 0, Math.PI * 2);
		ctx.fill();

		// Draw popup with name
		if (name) {
			ctx.font = '12px Arial';
			const padding = 10;
			const popupHeight = 30;
			const textWidth = ctx.measureText(name).width;
			const popupWidth = Math.max(100, textWidth + padding * 2);
			const popupX = markerX - popupWidth / 2;
			const popupY = pinTop - popupHeight - 10;

			ctx.fillStyle = isDarkMode ? '#333333' : '#ffffff';
			ctx.strokeStyle = isDarkMode ? '#555555' : '#dddddd';
			ctx.lineWidth = 1;
			ctx.beginPath();

			if (ctx.roundRect) {
				ctx.roundRect(popupX, popupY, popupWidth, popupHeight, 5);
			} else {
				const radius = 5;
				ctx.moveTo(popupX + radius, popupY);
				ctx.lineTo(popupX + popupWidth - radius, popupY);
				ctx.quadraticCurveTo(popupX + popupWidth, popupY, popupX + popupWidth, popupY + radius);
				ctx.lineTo(popupX + popupWidth, popupY + popupHeight - radius);
				ctx.quadraticCurveTo(
					popupX + popupWidth,
					popupY + popupHeight,
					popupX + popupWidth - radius,
					popupY + popupHeight
				);
				ctx.lineTo(popupX + radius, popupY + popupHeight);
				ctx.quadraticCurveTo(popupX, popupY + popupHeight, popupX, popupY + popupHeight - radius);
				ctx.lineTo(popupX, popupY + radius);
				ctx.quadraticCurveTo(popupX, popupY, popupX + radius, popupY);
			}

			ctx.fill();
			ctx.stroke();

			ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(name, markerX, popupY + popupHeight / 2);

			// Draw popup pointer
			const pointerSize = 8;
			ctx.fillStyle = isDarkMode ? '#333333' : '#ffffff';
			ctx.strokeStyle = isDarkMode ? '#555555' : '#dddddd';

			ctx.beginPath();
			ctx.moveTo(markerX, popupY + popupHeight);
			ctx.lineTo(markerX - pointerSize, popupY + popupHeight);
			ctx.lineTo(markerX, popupY + popupHeight + pointerSize);
			ctx.lineTo(markerX + pointerSize, popupY + popupHeight);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}

		ctx.restore();
	}

	// Draw map controls
	function drawControls(ctx) {
		const buttonSize = 30;
		const buttonX = canvasWidth - buttonSize - 10;
		const buttonY = 10;
		const buttonSpacing = buttonSize + 5;

		ctx.fillStyle = isDarkMode ? '#333333' : '#ffffff';
		ctx.strokeStyle = isDarkMode ? '#555555' : '#dddddd';
		ctx.lineWidth = 1;
		ctx.beginPath();

		if (ctx.roundRect) {
			ctx.roundRect(buttonX, buttonY, buttonSize, buttonSize, 4);
		} else {
			const radius = 4;
			ctx.moveTo(buttonX + radius, buttonY);
			ctx.lineTo(buttonX + buttonSize - radius, buttonY);
			ctx.quadraticCurveTo(buttonX + buttonSize, buttonY, buttonX + buttonSize, buttonY + radius);
			ctx.lineTo(buttonX + buttonSize, buttonY + buttonSize - radius);
			ctx.quadraticCurveTo(
				buttonX + buttonSize,
				buttonY + buttonSize,
				buttonX + buttonSize - radius,
				buttonY + buttonSize
			);
			ctx.lineTo(buttonX + radius, buttonY + buttonSize);
			ctx.quadraticCurveTo(buttonX, buttonY + buttonSize, buttonX, buttonY + buttonSize - radius);
			ctx.lineTo(buttonX, buttonY + radius);
			ctx.quadraticCurveTo(buttonX, buttonY, buttonX + radius, buttonY);
		}

		ctx.fill();
		ctx.stroke();

		// Draw + sign
		ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000';
		ctx.beginPath();
		ctx.moveTo(buttonX + buttonSize / 2 - 8, buttonY + buttonSize / 2);
		ctx.lineTo(buttonX + buttonSize / 2 + 8, buttonY + buttonSize / 2);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(buttonX + buttonSize / 2, buttonY + buttonSize / 2 - 8);
		ctx.lineTo(buttonX + buttonSize / 2, buttonY + buttonSize / 2 + 8);
		ctx.stroke();

		ctx.fillStyle = isDarkMode ? '#333333' : '#ffffff';
		ctx.strokeStyle = isDarkMode ? '#555555' : '#dddddd';
		ctx.beginPath();

		if (ctx.roundRect) {
			ctx.roundRect(buttonX, buttonY + buttonSpacing, buttonSize, buttonSize, 4);
		} else {
			const radius = 4;
			ctx.moveTo(buttonX + radius, buttonY + buttonSpacing);
			ctx.lineTo(buttonX + buttonSize - radius, buttonY + buttonSpacing);
			ctx.quadraticCurveTo(
				buttonX + buttonSize,
				buttonY + buttonSpacing,
				buttonX + buttonSize,
				buttonY + buttonSpacing + radius
			);
			ctx.lineTo(buttonX + buttonSize, buttonY + buttonSpacing + buttonSize - radius);
			ctx.quadraticCurveTo(
				buttonX + buttonSize,
				buttonY + buttonSpacing + buttonSize,
				buttonX + buttonSize - radius,
				buttonY + buttonSpacing + buttonSize
			);
			ctx.lineTo(buttonX + radius, buttonY + buttonSpacing + buttonSize);
			ctx.quadraticCurveTo(
				buttonX,
				buttonY + buttonSpacing + buttonSize,
				buttonX,
				buttonY + buttonSpacing + buttonSize - radius
			);
			ctx.lineTo(buttonX, buttonY + buttonSpacing + radius);
			ctx.quadraticCurveTo(
				buttonX,
				buttonY + buttonSpacing,
				buttonX + radius,
				buttonY + buttonSpacing
			);
		}

		ctx.fill();
		ctx.stroke();

		// Draw - sign
		ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000';
		ctx.beginPath();
		ctx.moveTo(buttonX + buttonSize / 2 - 8, buttonY + buttonSpacing + buttonSize / 2);
		ctx.lineTo(buttonX + buttonSize / 2 + 8, buttonY + buttonSpacing + buttonSize / 2);
		ctx.stroke();
	}

	function drawTile(ctx, x, y, z, drawX, drawY) {
		const tileKey = `${z}/${x}/${y}`;
		const tileServerUrl = isDarkMode ? tileServerDark : tileServerLight;
		const tileUrl = tileServerUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y);

		// Check if we have the tile in cache
		if (tileCache.has(tileKey)) {
			const img = tileCache.get(tileKey);
			if (img.complete) {
				ctx.drawImage(img, drawX, drawY);
			}
			return;
		}

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			ctx.drawImage(img, drawX, drawY);
			tileCache.set(tileKey, img);

			if (tileCache.size > 100) {
				const firstKey = tileCache.keys().next().value;
				tileCache.delete(firstKey);
			}
		};
		img.onerror = () => {
			console.error(`Failed to load tile ${tileKey} from ${tileUrl}`);
		};
		img.src = tileUrl;
	}

	function initMap() {
		if (!browser || !mapElement) return;

		mapElement.width = mapElement.clientWidth;
		mapElement.height = mapElement.clientHeight;
		canvasWidth = mapElement.width;
		canvasHeight = mapElement.height;

		if (browser) {
			isDarkMode = document.documentElement.classList.contains('dark');
			window.addEventListener('themeChange', handleThemeChange);
		}

		// Add event listeners for map controls
		mapElement.addEventListener('wheel', handleZoom);
		mapElement.addEventListener('mousedown', handleMouseDown);
		mapElement.addEventListener('mousemove', handleMouseMove);
		mapElement.addEventListener('mouseup', handleMouseUp);
		mapElement.addEventListener('mouseleave', handleMouseUp);
		mapElement.addEventListener('dblclick', handleDoubleClick);
		mapElement.addEventListener('click', handleClick);

		mapElement.addEventListener('touchstart', handleTouchStart);
		mapElement.addEventListener('touchmove', handleTouchMove);
		mapElement.addEventListener('touchend', handleTouchEnd);

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === mapElement) {
					mapElement.width = entry.contentRect.width;
					mapElement.height = entry.contentRect.height;
					canvasWidth = mapElement.width;
					canvasHeight = mapElement.height;
					refreshMap();
				}
			}
		});
		resizeObserver.observe(mapElement);

		// Mark as initialized and refresh
		mapInitialized = true;
		refreshMap();
	}

	// Handle theme changes
	function handleThemeChange(event) {
		const { darkMode } = event.detail;
		isDarkMode = darkMode;
		refreshMap();
	}

	// Handle mouse/touch interactions
	function handleMouseDown(e) {
		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		mapElement.style.cursor = 'grabbing';
	}

	function handleMouseMove(e) {
		if (!isDragging) return;

		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;

		// Calculate how much the map should move
		const scale = Math.pow(2, currentZoom);
		const lonDiff = (dx / 256) * (360 / scale);
		const latDiff = (dy / 256) * (170 / scale);

		mapCenterLat = Math.max(-85, Math.min(85, mapCenterLat - latDiff));
		mapCenterLon = mapCenterLon - lonDiff;

		mapCenterLon = ((mapCenterLon + 540) % 360) - 180;

		// Update drag start position
		dragStartX = e.clientX;
		dragStartY = e.clientY;

		refreshMap();
	}

	function handleMouseUp() {
		isDragging = false;
		mapElement.style.cursor = 'grab';
	}

	function handleZoom(e) {
		e.preventDefault();

		// Get mouse position for zoom targeting
		const rect = mapElement.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Calculate the lat/lon at the mouse position before zooming
		const mouseLatLon = getLatLonAtPoint(mouseX, mouseY);

		const zoomIn = e.deltaY < 0;

		const newZoom = Math.max(1, Math.min(19, currentZoom + (zoomIn ? 1 : -1)));

		if (newZoom !== currentZoom) {
			zoomToPoint(mouseLatLon.lat, mouseLatLon.lon, newZoom);
		}
	}

	function getLatLonAtPoint(x, y) {
		const centerPixelX = centerX * 256;
		const centerPixelY = centerY * 256;

		const pixelX = centerPixelX + (x - canvasWidth / 2);
		const pixelY = centerPixelY + (y - canvasHeight / 2);

		return xyToLatLon(pixelX / 256, pixelY / 256, currentZoom);
	}

	function zoomToPoint(targetLat, targetLon, newZoom) {
		currentZoom = newZoom;
		mapCenterLat = targetLat;
		mapCenterLon = targetLon;
		refreshMap();
	}

	function handleDoubleClick(e) {
		e.preventDefault();

		const rect = mapElement.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const clickLatLon = getLatLonAtPoint(x, y);

		zoomToPoint(clickLatLon.lat, clickLatLon.lon, Math.min(19, currentZoom + 1));
	}

	function handleClick(e) {
		if (showControls) {
			const buttonSize = 30;
			const buttonX = canvasWidth - buttonSize - 10;
			const buttonY = 10;
			const buttonSpacing = buttonSize + 5;

			const rect = mapElement.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			if (x >= buttonX && x <= buttonX + buttonSize && y >= buttonY && y <= buttonY + buttonSize) {
				// Zoom in at center
				zoomToPoint(mapCenterLat, mapCenterLon, Math.min(19, currentZoom + 1));
				return;
			}

			if (
				x >= buttonX &&
				x <= buttonX + buttonSize &&
				y >= buttonY + buttonSpacing &&
				y <= buttonY + buttonSpacing + buttonSize
			) {
				// Zoom out at center
				zoomToPoint(mapCenterLat, mapCenterLon, Math.max(1, currentZoom - 1));
				return;
			}
		}
	}

	function handleTouchStart(e) {
		if (e.touches.length === 1) {
			isDragging = true;
			dragStartX = e.touches[0].clientX;
			dragStartY = e.touches[0].clientY;
		}
	}

	function handleTouchMove(e) {
		if (!isDragging || e.touches.length !== 1) return;

		const dx = e.touches[0].clientX - dragStartX;
		const dy = e.touches[0].clientY - dragStartY;

		const scale = Math.pow(2, currentZoom);
		const lonDiff = (dx / 256) * (360 / scale);
		const latDiff = (dy / 256) * (170 / scale);

		// Update the map center
		mapCenterLat = Math.max(-85, Math.min(85, mapCenterLat - latDiff));
		mapCenterLon = mapCenterLon - lonDiff;

		mapCenterLon = ((mapCenterLon + 540) % 360) - 180;

		dragStartX = e.touches[0].clientX;
		dragStartY = e.touches[0].clientY;

		refreshMap();
	}

	function handleTouchEnd() {
		isDragging = false;
	}

	// Initialize map on mount
	onMount(() => {
		if (browser) {
			// Set initial values
			mapCenterLat = lat;
			mapCenterLon = lon;
			currentZoom = zoom;

			// Small delay to ensure canvas is fully ready
			setTimeout(initMap, 0);
		}
	});

	// Clean up event listeners on destroy
	onDestroy(() => {
		if (browser && mapElement) {
			mapElement.removeEventListener('wheel', handleZoom);
			mapElement.removeEventListener('mousedown', handleMouseDown);
			mapElement.removeEventListener('mousemove', handleMouseMove);
			mapElement.removeEventListener('mouseup', handleMouseUp);
			mapElement.removeEventListener('mouseleave', handleMouseUp);
			mapElement.removeEventListener('dblclick', handleDoubleClick);
			mapElement.removeEventListener('click', handleClick);
			mapElement.removeEventListener('touchstart', handleTouchStart);
			mapElement.removeEventListener('touchmove', handleTouchMove);
			mapElement.removeEventListener('touchend', handleTouchEnd);

			window.removeEventListener('themeChange', handleThemeChange);
		}
	});

	// Watch for prop changes
	$effect(() => {
		mapCenterLat = lat;
		mapCenterLon = lon;

		refreshMap();
		// Update internal state when props change
		if (mapInitialized) {
			// Always update center and marker position when lat/lon changes

			// Update zoom if changed
			if (currentZoom !== zoom) {
				currentZoom = zoom;
			}

			refreshMap();
		}
	});

	onMount(() => {
		if (browser) {
			// Set initial values
			mapCenterLat = lat;
			mapCenterLon = lon;
			currentZoom = zoom;

			// Small delay to ensure canvas is fully ready
			setTimeout(initMap, 0);
		}
	});
</script>

<div class="relative h-full w-full">
	<canvas
		bind:this={mapElement}
		class="h-full min-h-64 w-full cursor-grab rounded border border-gray-300"
		aria-label="Map showing location of stop {name}"
	></canvas>
</div>
