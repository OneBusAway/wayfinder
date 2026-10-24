import { writable } from 'svelte/store';

export const showSurveyModal = writable(false);
/**
 * @typedef {{ id: string | number, content: { type: string, label_text: string } }} SurveyQuestion
 * @typedef {{ id: string | number, questions: SurveyQuestion[], allows_multiple_responses?: boolean, always_visible?: boolean }} Survey
 */

/** @type {import('svelte/store').Writable<Survey | null>} */
export const surveyStore = writable(null);

/** @type {Record<string | number, boolean>} */
const initial = {};

export const answeredSurveys = writable(initial);

export function markSurveyAnswered(surveyId) {
	answeredSurveys.update((map) => {
		localStorage.setItem(`survey_${surveyId}_answered`, 'true');
		return { ...map, [surveyId]: true };
	});
}
