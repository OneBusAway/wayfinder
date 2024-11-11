export function compassDirection(abbreviation) {
	switch (abbreviation) {
		case 'N':
			return 'North';
		case 'NE':
			return 'Northeast';
		case 'E':
			return 'East';
		case 'SE':
			return 'Southeast';
		case 'S':
			return 'South';
		case 'SW':
			return 'Southwest';
		case 'W':
			return 'West';
		case 'NW':
			return 'Northwest';
		default:
			return abbreviation;
	}
}

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
