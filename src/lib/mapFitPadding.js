/**
 * Derive per-side map fit padding from an overlay panel's bounding rect so a
 * fitted route frames into the visible map area rather than under the panel.
 *
 * Pads whichever edge the overlay occupies: a wide bottom sheet below md, or
 * the side column (left, or right under RTL) from md up. Reading the real rect
 * keeps this correct for RTL and for every snap detent without duplicating the
 * sheet's layout constants.
 *
 * Clamps any single side to 60% of the viewport so a full-height sheet can't
 * force an absurd zoom-out. Returns uniform `base` padding for a zero/absent
 * rect (jsdom, or a not-yet-measured sheet).
 *
 * @param {{ top: number, right: number, bottom: number, left: number, width: number, height: number } | null | undefined} panelRect
 * @param {{ width: number, height: number } | null | undefined} viewport
 * @param {number} [base=48]
 * @returns {{ top: number, right: number, bottom: number, left: number }}
 */
export function panelFitPadding(panelRect, viewport, base = 48) {
	const uniform = { top: base, right: base, bottom: base, left: base };
	if (!panelRect || !viewport?.width || !viewport?.height) return uniform;
	if (panelRect.width <= 0 || panelRect.height <= 0) return uniform;

	const { width: vw, height: vh } = viewport;
	const clamp = (value, max) => Math.min(Math.max(value, base), max);

	const padding = { ...uniform };

	// Tall + narrow → side panel (desktop itinerary column). Wide → bottom sheet.
	const isSidePanel = panelRect.width < vw * 0.5;

	if (isSidePanel) {
		const centerX = panelRect.left + panelRect.width / 2;
		if (centerX < vw / 2) {
			// Panel on the left: pad by how far it extends from the left edge.
			padding.left = clamp(Math.max(0, panelRect.right) + base, vw * 0.6);
		} else {
			// Panel on the right (RTL): pad by how far it extends from the right edge.
			padding.right = clamp(Math.max(0, vw - panelRect.left) + base, vw * 0.6);
		}
	} else {
		const centerY = panelRect.top + panelRect.height / 2;
		if (centerY >= vh / 2) {
			// Bottom sheet: pad by the occluded strip from the panel's top to the
			// bottom of the viewport.
			padding.bottom = clamp(Math.max(0, vh - panelRect.top) + base, vh * 0.6);
		} else {
			padding.top = clamp(Math.max(0, panelRect.bottom) + base, vh * 0.6);
		}
	}

	return padding;
}
