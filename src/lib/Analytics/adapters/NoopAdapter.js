export class NoopAdapter {
	isEnabled() {
		return false;
	}

	async forwardEvent() {
		return { status: 'analytics disabled' };
	}
}
