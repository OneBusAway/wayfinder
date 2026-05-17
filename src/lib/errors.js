/** @type {ReadonlySet<string>} */
const GENERIC_ERROR_MESSAGES = new Set(['Not Found', 'Internal Error']);

/**
 * Translation keys for common HTTP error statuses.
 *
 * @param {number} status
 * @returns {{ titleKey: string; messageKey: string }}
 */
export function getErrorTranslationKeys(status) {
	if (status === 404) {
		return {
			titleKey: 'errors.not_found_title',
			messageKey: 'errors.not_found_message'
		};
	}

	if (status >= 500) {
		return {
			titleKey: 'errors.server_error_title',
			messageKey: 'errors.server_error_message'
		};
	}

	return {
		titleKey: 'errors.generic_title',
		messageKey: 'errors.generic_message'
	};
}

/**
 * Returns a user-facing detail message when the thrown error carries a custom message.
 *
 * @param {App.Error | null | undefined} error
 * @param {number} status
 * @returns {string | null}
 */
export function getCustomErrorDetail(error, status) {
	if (!error?.message || status >= 500) {
		return null;
	}

	const message = error.message.trim();
	if (!message || GENERIC_ERROR_MESSAGES.has(message)) {
		return null;
	}

	return message;
}
