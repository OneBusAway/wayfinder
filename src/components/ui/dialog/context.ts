import { getContext, setContext } from "svelte";

const DIALOG_CONTENT_KEY = Symbol("dialog-content");

interface DialogContentContext {
	readonly showCloseButton: boolean;
}

export function setDialogContentContext(context: DialogContentContext) {
	setContext(DIALOG_CONTENT_KEY, context);
}

export function getDialogContentContext(): DialogContentContext | undefined {
	return getContext(DIALOG_CONTENT_KEY);
}
