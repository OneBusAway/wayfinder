import { describe, it, expect } from 'vitest';
import { panelFitPadding } from '../mapFitPadding.js';

describe('panelFitPadding', () => {
	const base = 48;

	it('returns uniform base padding for a null/zero rect', () => {
		const viewport = { width: 400, height: 800 };
		expect(panelFitPadding(null, viewport, base)).toEqual({
			top: base,
			right: base,
			bottom: base,
			left: base
		});
		expect(
			panelFitPadding({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }, viewport, base)
		).toEqual({
			top: base,
			right: base,
			bottom: base,
			left: base
		});
		expect(
			panelFitPadding(
				{ top: 400, left: 0, right: 400, bottom: 800, width: 400, height: 400 },
				null,
				base
			)
		).toEqual({
			top: base,
			right: base,
			bottom: base,
			left: base
		});
	});

	it('pads the bottom for a mobile bottom sheet (wide overlay)', () => {
		const viewport = { width: 400, height: 800 };
		// Half detent: sheet covers the bottom ~55% of the viewport.
		const sheet = { top: 360, left: 0, right: 400, bottom: 800, width: 400, height: 440 };

		const padding = panelFitPadding(sheet, viewport, base);

		// Occlusion is vh - sheet.top = 440, plus base = 488, clamped to 0.6 * 800 = 480.
		expect(padding.bottom).toBe(480);
		expect(padding.top).toBe(base);
		expect(padding.left).toBe(base);
		expect(padding.right).toBe(base);
	});

	it('pads the left for a desktop side column', () => {
		const viewport = { width: 1280, height: 800 };
		// md:w-96 column with md:mx-4 margin.
		const panel = { top: 80, left: 16, right: 400, bottom: 800, width: 384, height: 720 };

		const padding = panelFitPadding(panel, viewport, base);

		expect(padding.left).toBe(400 + base);
		expect(padding.right).toBe(base);
		expect(padding.bottom).toBe(base);
		expect(padding.top).toBe(base);
	});

	it('pads the right for an RTL side column', () => {
		const viewport = { width: 1280, height: 800 };
		const panel = { top: 80, left: 880, right: 1264, bottom: 800, width: 384, height: 720 };

		const padding = panelFitPadding(panel, viewport, base);

		expect(padding.right).toBe(1280 - 880 + base);
		expect(padding.left).toBe(base);
		expect(padding.bottom).toBe(base);
		expect(padding.top).toBe(base);
	});

	it('clamps any single side to 60% of the viewport', () => {
		const viewport = { width: 400, height: 800 };
		// Full-height sheet would otherwise demand ~800+48 bottom padding.
		const sheet = { top: 0, left: 0, right: 400, bottom: 800, width: 400, height: 800 };

		const padding = panelFitPadding(sheet, viewport, base);

		expect(padding.bottom).toBe(viewport.height * 0.6);
	});
});
