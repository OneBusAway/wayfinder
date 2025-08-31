export function formatLastUpdated(timestamp, translations) {
	const date = new Date(timestamp);
	const now = new Date();
	const secondsAgo = Math.floor((now - date) / 1000);

	const minutes = Math.floor(secondsAgo / 60);
	const seconds = secondsAgo % 60;

	if (minutes > 0) {
		return `${minutes} ${translations.min} ${seconds} ${translations.sec} ${translations.ago}`;
	}
	return `${seconds} ${translations.sec} ${translations.ago}`;
}

export function formatTime(dateString) {
	return new Date(dateString).toLocaleTimeString([], {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

export function convertUnixToTime(seconds) {
	if (!seconds) return '';
	const date = new Date(seconds * 1000);
	const utcDate = new Date(date.toUTCString().slice(0, -4));
	return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
