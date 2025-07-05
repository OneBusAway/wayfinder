/**
 * Create a keybinding for an HTML element.
 * @example
 *  <button use:keybinding={{code: 'Escape'}} on:click={yourEventHere}>
 *    Triggers a click on the button when the Escape key is pressed.
 *  </button>
 * @param {HTMLElement} node The HTML element to bind to.
 * @param {Object} params The keybinding parameters. See the example above.
 * @returns {Object} An object with the update and destroy methods.
 */
export const keybinding = (node, params) => {
	let handler;
	let currentParams = params;
	const removeHandler = () => window.removeEventListener('keydown', handler);
	const setHandler = (newParams) => {
		if (newParams !== undefined) {
			currentParams = newParams;
		}
		removeHandler();
		if (!currentParams) {
			return;
		}

		handler = (e) => {
			if (
				!!currentParams.alt != e.altKey ||
				!!currentParams.shift != e.shiftKey ||
				!!currentParams.control != (e.ctrlKey || e.metaKey) ||
				currentParams.code != e.code
			)
				return;
			e.preventDefault();
			currentParams.callback ? currentParams.callback() : node.click();
		};
		window.addEventListener('keydown', handler);
	};

	setHandler();

	return {
		update: setHandler,
		destroy: removeHandler
	};
};
