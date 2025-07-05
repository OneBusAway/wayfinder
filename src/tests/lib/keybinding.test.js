import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { keybinding } from '$lib/keybinding';

describe('keybinding action', () => {
	let node;
	let mockWindow;
	let currentHandler;

	beforeEach(() => {
		node = {
			click: vi.fn()
		};

		mockWindow = {
			addEventListener: vi.fn((event, handler) => {
				if (event === 'keydown') {
					currentHandler = handler;
				}
			}),
			removeEventListener: vi.fn((event, handler) => {
				if (event === 'keydown' && handler === currentHandler) {
					currentHandler = null;
				}
			})
		};

		// Mock window globally
		vi.stubGlobal('window', mockWindow);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
		currentHandler = null;
	});

	const triggerKeydown = (keyParams) => {
		const event = {
			code: keyParams.code || '',
			altKey: keyParams.alt || false,
			shiftKey: keyParams.shift || false,
			ctrlKey: keyParams.control || false,
			metaKey: keyParams.control || false,
			preventDefault: vi.fn()
		};

		if (currentHandler) {
			currentHandler(event);
		}
		return event;
	};

	it('adds keydown event listener on initialization', () => {
		keybinding(node, { code: 'KeyA' });
		expect(mockWindow.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
	});

	it('removes existing listener before adding new one on update', () => {
		let params = { code: 'KeyA' };
		const action = keybinding(node, params);

		// Clear the initial setup calls
		mockWindow.addEventListener.mockClear();
		mockWindow.removeEventListener.mockClear();

		// Update with new params
		action.update({ code: 'KeyB' });

		expect(mockWindow.removeEventListener).toHaveBeenCalledTimes(1);
		expect(mockWindow.addEventListener).toHaveBeenCalledTimes(1);
	});

	it('removes listener on destroy', () => {
		const action = keybinding(node, { code: 'KeyA' });
		action.destroy();

		expect(mockWindow.removeEventListener).toHaveBeenCalled();
	});

	it('only responds to matching key code', () => {
		keybinding(node, { code: 'KeyA' });

		triggerKeydown({ code: 'KeyB' });
		expect(node.click).not.toHaveBeenCalled();

		triggerKeydown({ code: 'KeyA' });
		expect(node.click).toHaveBeenCalledTimes(1);
	});

	it('responds to updated key code', () => {
		// Create initial binding
		const action = keybinding(node, { code: 'KeyA' });

		// Verify initial binding works
		triggerKeydown({ code: 'KeyA' });
		expect(node.click).toHaveBeenCalledTimes(1);

		// Update with new params
		node.click.mockClear();
		action.update({ code: 'KeyB' });

		// Verify new binding works
		triggerKeydown({ code: 'KeyB' });
		expect(node.click).toHaveBeenCalledTimes(1);

		// Verify old binding doesn't work
		node.click.mockClear();
		triggerKeydown({ code: 'KeyA' });
		expect(node.click).not.toHaveBeenCalled();
	});

	it('handles modifier keys correctly', () => {
		keybinding(node, {
			code: 'KeyA',
			alt: true,
			shift: true,
			control: true
		});

		triggerKeydown({ code: 'KeyA' });
		expect(node.click).not.toHaveBeenCalled();

		triggerKeydown({ code: 'KeyA', alt: true });
		expect(node.click).not.toHaveBeenCalled();

		triggerKeydown({ code: 'KeyA', alt: true, shift: true, control: true });
		expect(node.click).toHaveBeenCalledTimes(1);
	});

	it('handles meta key as control', () => {
		keybinding(node, {
			code: 'KeyA',
			control: true
		});

		const event = triggerKeydown({ code: 'KeyA', control: true });
		expect(node.click).toHaveBeenCalledTimes(1);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	it('triggers callback instead of click when provided', () => {
		const callback = vi.fn();
		keybinding(node, { code: 'KeyA', callback });

		triggerKeydown({ code: 'KeyA' });

		expect(callback).toHaveBeenCalledTimes(1);
		expect(node.click).not.toHaveBeenCalled();
	});
});
