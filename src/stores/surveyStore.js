import { writable } from 'svelte/store';

export const showSurveyModal = writable(false);
export const surveyStore = writable(null);

const initial = {};

export const answeredSurveys = writable(initial);

export function markSurveyAnswered(surveyId) {
	answeredSurveys.update((map) => {
		localStorage.setItem(`survey_${surveyId}_answered`, 'true');
		return { ...map, [surveyId]: true };
	});
}
