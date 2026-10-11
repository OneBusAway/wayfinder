import { resolvePickupBookingRule } from '$lib/onDemand/models.js';
import { compareInstants, earliestAfter, minInstant } from '$lib/onDemand/instants.js';

/**
 * The service-level booking line, a port of iOS OnDemandBookingResolution:
 * the earliest bookable candidate wins (same date: the earliest cutoff);
 * otherwise the earliest not-yet-open instant; otherwise unknown if any rule
 * couldn't be evaluated, else closed.
 * @param {import('./models.js').OnDemandService} service
 * @param {ReturnType<import('./bookingDeadline.js').createEvaluator>} evaluator
 * @param {Temporal.Instant} now
 */
export function resolveBooking(service, evaluator, now) {
	if (service.rules.length === 0)
		return { resolution: { kind: 'unknown' }, nextChangeInstant: null };

	const bookable = [];
	const notYetOpen = [];
	let sawUnknown = false;
	for (const rule of service.rules) {
		const outcome = ruleOutcome(rule, service, evaluator, now);
		if (outcome.kind === 'unresolved')
			return { resolution: { kind: 'unknown' }, nextChangeInstant: null };
		if (outcome.kind === 'bookable') bookable.push(outcome);
		else if (outcome.kind === 'notYetOpen') notYetOpen.push(outcome.openInstant);
		else if (outcome.kind === 'unknown') sawUnknown = true;
	}

	const boundaries = [
		...bookable.map((candidate) => candidate.evaluation.cutoffInstant),
		...notYetOpen
	];
	return {
		resolution: resolved(bookable, notYetOpen, sawUnknown),
		nextChangeInstant: earliestAfter(boundaries, now)
	};
}

function ruleOutcome(rule, service, evaluator, now) {
	const { bookingRule, dangling } = resolvePickupBookingRule(service, rule);
	if (dangling) return { kind: 'unresolved' };
	if (!evaluator.hasUsableCalendar(rule)) return { kind: 'unknown' };

	let candidate = null;
	let firstOpenInstant = null;
	let sawUnknown = false;
	evaluator.walkServiceDates(rule, bookingRule, now, (travelDate, evaluation) => {
		if (evaluation.state === 'open') {
			candidate = { travelDate, evaluation };
			return false;
		}
		if (evaluation.state === 'notYetOpen') firstOpenInstant ??= evaluation.openInstant;
		else if (evaluation.state === 'unknown') sawUnknown = true;
		return true;
	});

	if (candidate) return { kind: 'bookable', ...candidate };
	if (firstOpenInstant) return { kind: 'notYetOpen', openInstant: firstOpenInstant };
	return { kind: sawUnknown ? 'unknown' : 'settled' };
}

function resolved(bookable, notYetOpen, sawUnknown) {
	if (bookable.length) {
		const best = bookable.reduce((winner, candidate) =>
			compareCandidates(candidate, winner) < 0 ? candidate : winner
		);
		const cutoff = best.evaluation.cutoffInstant;
		return cutoff
			? { kind: 'bookBy', cutoff, travelDate: best.travelDate }
			: { kind: 'noNoticeRequired' };
	}
	if (notYetOpen.length) return { kind: 'opensAt', instant: minInstant(notYetOpen) };
	return { kind: sawUnknown ? 'unknown' : 'closed' };
}

function compareCandidates(a, b) {
	const byDate = Temporal.PlainDate.compare(a.travelDate, b.travelDate);
	if (byDate !== 0) return byDate;
	const cutoffA = a.evaluation.cutoffInstant;
	const cutoffB = b.evaluation.cutoffInstant;
	if (!cutoffA || !cutoffB) return cutoffA ? -1 : cutoffB ? 1 : 0;
	return compareInstants(cutoffA, cutoffB);
}
