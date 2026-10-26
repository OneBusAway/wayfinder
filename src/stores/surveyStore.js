import { writable } from 'svelte/store';

export const showSurveyModal = writable(false);

/**
 * @typedef {string | string[]} SurveyAnswer a string, or the selected options of a checkbox question
 * @typedef {{ content: { label_text: string, options?: string[], survey_provider?: string, type: string, url?: string }, id: string | number, required?: boolean }} SurveyQuestion
 * @typedef {{ allows_multiple_responses?: boolean, always_visible?: boolean, id: string | number, name: string, questions: SurveyQuestion[], show_on_map: boolean }} Survey
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
