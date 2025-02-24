import { markSurveyAnswered, showSurveyModal, surveyStore } from '$stores/surveyStore.js';

export async function loadSurveys(stop = null, userId = null) {
	try {
		const response = await fetch(`/api/oba/surveys?userId=${userId}`);
		if (!response.ok) throw new Error('Failed to fetch surveys');

		const data = await response.json();
		const validSurveys = getValidSurveys(data.surveys);

		let selectedSurvey = null;

		if (stop) {
			selectedSurvey =
				getValidStopSurvey(validSurveys, stop) || getShowSurveyOnAllStops(validSurveys);
		} else {
			selectedSurvey = getMapSurvey(validSurveys);
		}

		// This is the case when there's multiple surveys and we need to prioritize the one-time survey over the always visible one
		selectedSurvey = getPrioritySurvey(validSurveys, selectedSurvey);
		surveyStore.set(selectedSurvey);

	} catch (error) {
		console.error('Error loading surveys:', error);
	}
}

export function getPrioritySurvey(validSurveys, selectedSurvey) {
	const oneTimeSurvey = validSurveys.find((s) => !s.always_visible);
	const alwaysVisibleSurvey = validSurveys.find((s) => s.always_visible);
	return oneTimeSurvey || alwaysVisibleSurvey || selectedSurvey;
}

export function getValidSurveys(surveys) {
	const now = Date.now();
	const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
	const validSurveys = [];

	for (const survey of surveys) {
		const isValidEndDate = survey.end_date ? new Date(survey.end_date).getTime() > now : true;
		const hasResponded = !!localStorage.getItem(`survey_${survey.id}_answered`);
		const hasSkipped = !!localStorage.getItem(`survey_${survey.id}_skipped`);

		// Get skip timestamp and check if it's within the last week
		const skipTimestamp = localStorage.getItem(`survey_${survey.id}_skipped_timestamp`);
		const wasRecentlySkipped = skipTimestamp && now - parseInt(skipTimestamp, 10) < oneWeekInMs;

		//! Skip if end date is in the past or if it was recently skipped (1 week)
		if (!isValidEndDate || wasRecentlySkipped || hasSkipped) continue;

		if (survey.always_visible) {
			if (survey.allows_multiple_responses) {
				validSurveys.push(survey); // Always visible & allows multiple responses, show regardless
			} else {
				if (!hasResponded) {
					validSurveys.push(survey);
				}
			}
		} else {
			// Standard behavior for surveys, show if not answered and not skipped
			if (!hasResponded && !hasSkipped) {
				validSurveys.push(survey);
			}
		}
	}

	return validSurveys;
}

export function shouldShowSurvey(survey) {
	if (!survey) return false;

	if ((survey.always_visible && survey.allows_multiple_responses) || survey.show_on_map) {
		return true;
	}

	return (
		!localStorage.getItem(`survey_${survey.id}_answered`) &&
		!localStorage.getItem(`survey_${survey.id}_skipped`)
	);
}

export function getValidStopSurvey(surveys, stop) {
	for (const survey of surveys) {
		if (!survey.show_on_stops) continue;

		if (survey.visible_stop_list && survey.visible_stop_list.includes(stop.id)) {
			return survey;
		}

		if (
			survey.visible_route_list &&
			Array.isArray(survey.visible_route_list) &&
			stop.routeIds &&
			Array.isArray(stop.routeIds)
		) {
			for (const routeId of survey.visible_route_list) {
				if (stop.routeIds.includes(routeId)) {
					return survey;
				}
			}
		}
	}
	return null;
}

export function getShowSurveyOnAllStops(surveys) {
	return surveys.find((survey) => survey.show_on_stops && !survey.visible_stop_list) || null;
}

export function getMapSurvey(surveys) {
	return surveys.find((survey) => survey.show_on_map) || null;
}

export async function submitHeroQuestion(surveyResponse) {
	try {
		const payload = {
			...surveyResponse,
			responses: JSON.stringify([surveyResponse.responses[0]])
		};
		const response = await fetch('/api/oba/surveys/submit-survey', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(payload)
		});
		if (!response.ok) {
			throw new Error('Failed to submit survey response', response);
		}
		const data = await response.json();
		return data.survey_response.id;
	} catch (error) {
		console.error('Error submitting hero question:', error);
		throw error;
	}
}

export async function updateSurveyResponse(surveyPublicIdentifier, surveyResponse) {
	try {
		const payload = {
			...surveyResponse,
			responses: JSON.stringify(surveyResponse.responses)
		};
		const response = await fetch(`/api/oba/surveys/update-survey/${surveyPublicIdentifier}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(payload)
		});
		if (!response.ok) {
			throw new Error('Failed to update survey response');
		}
		return true;
	} catch (error) {
		console.error('Error updating survey response:', error);
		throw error;
	}
}

export function submitSurvey(survey, hideSurveyModal) {
	markSurveyAnswered(survey.id);
	if (hideSurveyModal) {
		setTimeout(() => {
			showSurveyModal.set(false);
		}, 3000);
	}
}

export function skipSurvey(survey) {
	const now = Date.now();

	if (survey.allows_multiple_responses && survey.always_visible) {
		localStorage.setItem(`survey_${survey.id}_skipped_timestamp`, now);
	}
	localStorage.setItem(`survey_${survey.id}_skipped`, true);
	showSurveyModal.set(false);
}
