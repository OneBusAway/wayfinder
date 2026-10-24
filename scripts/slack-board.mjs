#!/usr/bin/env node

/**
 * Builds the Wayfinder contributor board and writes it to a Slack channel canvas.
 *
 *   node scripts/slack-board.mjs --dry-run
 *   SLACK_BOT_TOKEN=xoxb-... node scripts/slack-board.mjs --channel C0CC5E4UG8Y
 *
 * GitHub auth comes from GITHUB_TOKEN, GH_TOKEN, or `gh auth token`.
 *
 * The script replaces the whole canvas on every run, so anything edited in Slack
 * is overwritten. The static sections live here, not in the canvas.
 *
 * PR states are derived from submitted reviews rather than requested reviewers:
 * contributors without write access cannot request a reviewer, so their PRs would
 * otherwise never appear in any review queue.
 */

import { execFileSync } from 'node:child_process';

const REPO = process.env.BOARD_REPO ?? 'OneBusAway/wayfinder';
const CANVAS_TITLE = 'Wayfinder Contributor Board';
const GOOD_FIRST_ISSUE = 'good first issue';
const STALE_AUTHOR_DAYS = 7;
const MERGED_WINDOW_DAYS = 7;
const MERGED_SHOWN = 6;
const TITLE_MAX = 58;

/** Review bots comment on everything; counting them would empty the first-review queue. */
const BOT_REVIEWERS = new Set(['coderabbitai', 'codecov', 'sonarcloud', 'github-actions']);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const channel = valueOf('--channel') ?? process.env.SLACK_CHANNEL_ID;
const canvasOverride = valueOf('--canvas') ?? process.env.SLACK_CANVAS_ID;
const setupAccess = args.includes('--setup-access');
const EDITORS = (valueOf('--editors') ?? process.env.SLACK_EDITOR_IDS ?? '')
	.split(',')
	.map((id) => id.trim())
	.filter(Boolean);

function valueOf(flag) {
	const i = args.indexOf(flag);
	return i === -1 ? undefined : args[i + 1];
}

function githubToken() {
	const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
	if (fromEnv) return fromEnv;
	try {
		return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
	} catch {
		throw new Error('No GitHub token. Set GITHUB_TOKEN or run `gh auth login`.');
	}
}

const QUERY = `
query($owner: String!, $name: String!, $label: String!) {
  repository(owner: $owner, name: $name) {
    open: pullRequests(states: OPEN, first: 100, orderBy: {field: CREATED_AT, direction: ASC}) {
      nodes {
        number title url createdAt isDraft
        author { login }
        reviews(last: 50) {
          nodes { state submittedAt author { login __typename } }
        }
        commits(last: 1) {
          nodes { commit { committedDate statusCheckRollup { state } } }
        }
      }
    }
    merged: pullRequests(states: MERGED, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { number title url mergedAt author { login } }
    }
    issues(states: OPEN, first: 100, labels: [$label], orderBy: {field: CREATED_AT, direction: ASC}) {
      nodes {
        number title url
        assignees(first: 5) { nodes { login } }
      }
    }
  }
}`;

async function fetchRepoState() {
	const [owner, name] = REPO.split('/');
	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: {
			authorization: `Bearer ${githubToken()}`,
			'content-type': 'application/json',
			'user-agent': 'wayfinder-slack-board'
		},
		body: JSON.stringify({ query: QUERY, variables: { owner, name, label: GOOD_FIRST_ISSUE } })
	});

	if (!res.ok) throw new Error(`GitHub API returned ${res.status}: ${await res.text()}`);

	const body = await res.json();
	if (body.errors) throw new Error(`GitHub GraphQL error: ${JSON.stringify(body.errors)}`);
	if (!body.data?.repository) throw new Error(`Repository ${REPO} not found or not visible.`);

	return body.data.repository;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);

function age(iso) {
	const days = daysSince(iso);
	if (days === 0) return 'today';
	if (days === 1) return '1 day';
	return `${days} days`;
}

const CI_LABEL = { SUCCESS: 'pass', FAILURE: 'fail', ERROR: 'fail', PENDING: 'running' };
const ci = (pr) => CI_LABEL[pr.commits.nodes[0]?.commit?.statusCheckRollup?.state] ?? '–';
const lastCommitDate = (pr) => pr.commits.nodes[0]?.commit?.committedDate;
const handle = (user) => (user?.login ? `@${user.login}` : 'unknown');

const isBot = (user) =>
	!user?.login ||
	user.__typename === 'Bot' ||
	user.login.endsWith('[bot]') ||
	BOT_REVIEWERS.has(user.login.toLowerCase());

/** Table cells are pipe-delimited, and PR titles regularly contain pipes. */
const cell = (text) => text.replaceAll('|', '\\|');

function link(item) {
	const title =
		item.title.length > TITLE_MAX ? `${item.title.slice(0, TITLE_MAX - 1)}…` : item.title;
	return `[#${item.number} ${cell(title)}](${item.url})`;
}

function table(headers, rows) {
	return [
		`| ${headers.join(' | ')} |`,
		`| ${headers.map(() => '---').join(' | ')} |`,
		...rows.map((row) => `| ${row.join(' | ')} |`)
	];
}

/**
 * Reviews that mean somebody else looked. Replying in a review thread on your own
 * PR records a COMMENTED review authored by you, which would otherwise hide the PR
 * from the first-review queue.
 */
const humanReviews = (pr) =>
	pr.reviews.nodes.filter((r) => !isBot(r.author) && r.author?.login !== pr.author?.login);

function latestDecisions(pr) {
	const byReviewer = new Map();
	for (const review of humanReviews(pr)) {
		if (review.state !== 'APPROVED' && review.state !== 'CHANGES_REQUESTED') continue;
		const key = review.author?.login ?? 'unknown';
		const seen = byReviewer.get(key);
		if (!seen || new Date(review.submittedAt) > new Date(seen.submittedAt)) {
			byReviewer.set(key, review);
		}
	}
	return [...byReviewer.values()];
}

function classify(pr) {
	const decisions = latestDecisions(pr);
	const changesRequested = decisions.filter((r) => r.state === 'CHANGES_REQUESTED');
	const approvals = decisions.filter((r) => r.state === 'APPROVED');
	const reviews = humanReviews(pr);
	const commenters = [
		...new Set(reviews.filter((r) => r.state === 'COMMENTED').map((r) => handle(r.author)))
	];
	const looked = reviews.some((r) => r.state !== 'PENDING');
	const committed = lastCommitDate(pr);

	if (changesRequested.length > 0) {
		const by = [...new Set(changesRequested.map((r) => handle(r.author)))];
		const requestedAt = changesRequested
			.map((r) => new Date(r.submittedAt))
			.reduce((a, b) => (a > b ? a : b));
		const pushedSince = committed && new Date(committed) > requestedAt;
		if (pushedSince) return { state: 'reReview', since: committed, by };
		const idleSince = committed ?? requestedAt.toISOString();
		if (daysSince(idleSince) < STALE_AUTHOR_DAYS) return { state: 'withAuthorRecent' };
		return { state: 'withAuthor', since: idleSince, by };
	}

	if (approvals.length > 0) {
		const by = [...new Set(approvals.map((r) => handle(r.author)))];
		return { state: 'approved', since: pr.createdAt, by };
	}

	if (!looked) return { state: 'firstReview', since: pr.createdAt, by: [] };
	return { state: 'decision', since: pr.createdAt, by: commenters };
}

function buildBoard(repo) {
	const buckets = { firstReview: [], reReview: [], withAuthor: [], decision: [], approved: [] };

	for (const pr of repo.open.nodes) {
		if (pr.isDraft) continue;
		const verdict = classify(pr);
		if (!buckets[verdict.state]) continue;
		buckets[verdict.state].push({ ...pr, ...verdict });
	}

	for (const list of Object.values(buckets)) {
		list.sort((a, b) => new Date(a.since) - new Date(b.since));
	}

	const needsYou =
		buckets.firstReview.length +
		buckets.reReview.length +
		buckets.decision.length +
		buckets.approved.length;
	const free = repo.issues.nodes.filter((issue) => issue.assignees.nodes.length === 0).length;
	const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

	// Slack already shows CANVAS_TITLE above the document, so no heading here.
	const out = [
		`**${needsYou} PR${needsYou === 1 ? '' : 's'} need a maintainer · ${buckets.withAuthor.length} waiting on authors · ${free} issue${free === 1 ? '' : 's'} free to claim**`,
		'',
		`Generated from GitHub, refreshed hourly. Last run ${stamp} UTC. Edits here are overwritten.`,
		''
	];

	const prSection = (heading, note, rows, columns) => {
		if (rows.length === 0) return;
		out.push(`## ${heading}`, '');
		if (note) out.push(note, '');
		out.push(
			...table(
				['Pull request', 'Author', ...columns.map((c) => c.header), 'CI'],
				rows.map((pr) => [link(pr), handle(pr.author), ...columns.map((c) => c.value(pr)), ci(pr)])
			),
			''
		);
	};

	const people = (pr) => (pr.by.length > 0 ? pr.by.join(', ') : '–');

	prSection(
		'Needs a first review',
		'Nobody has reviewed these yet. Oldest first.',
		buckets.firstReview,
		[{ header: 'Open for', value: (pr) => age(pr.since) }]
	);

	prSection(
		'Needs a re-review',
		'Changes were requested and the author has pushed since. These are back with us.',
		buckets.reReview,
		[
			{ header: 'Pushed', value: (pr) => age(pr.since) },
			{ header: 'Reviewer', value: people }
		]
	);

	prSection(
		'Needs a decision',
		'Reviewed with comments, but never approved or sent back.',
		buckets.decision,
		[
			{ header: 'Open for', value: (pr) => age(pr.since) },
			{ header: 'Commented by', value: people }
		]
	);

	prSection('Ready to merge', 'Approved. Check CI, then merge.', buckets.approved, [
		{ header: 'Approved by', value: people }
	]);

	prSection(
		`Waiting on the author (${STALE_AUTHOR_DAYS}+ days)`,
		'Changes requested, nothing pushed since. Nudge or close.',
		buckets.withAuthor,
		[
			{ header: 'Idle', value: (pr) => age(pr.since) },
			{ header: 'Reviewer', value: people }
		]
	);

	out.push('## Good first issues', '');
	if (repo.issues.nodes.length === 0) {
		out.push(
			`No open "${GOOD_FIRST_ISSUE}" right now — ask in the channel and we will find you one.`,
			''
		);
	} else {
		out.push(
			'Comment on an issue to claim it, so two people do not build the same thing.',
			'',
			...table(
				['Issue', 'Claimed by'],
				repo.issues.nodes.map((issue) => [
					link(issue),
					issue.assignees.nodes.map((a) => `@${a.login}`).join(', ') || '_available_'
				])
			),
			''
		);
	}

	const merged = repo.merged.nodes.filter(
		(pr) => pr.mergedAt && daysSince(pr.mergedAt) < MERGED_WINDOW_DAYS
	);
	out.push('## Merged this week', '');
	if (merged.length === 0) {
		out.push('Nothing merged in the last 7 days.', '');
	} else {
		for (const pr of merged.slice(0, MERGED_SHOWN)) {
			out.push(`- ${link(pr)} — ${handle(pr.author)}`);
		}
		if (merged.length > MERGED_SHOWN) {
			out.push(`- …and ${merged.length - MERGED_SHOWN} more`);
		}
		out.push('');
	}

	out.push(
		'## Who to ping',
		'',
		'- API layer, env schema, map providers, releases — Aaron',
		'- Components, tests, i18n, help with your first PR — Tarun',
		'',
		'You do not need anyone to assign you a reviewer. Open the PR and it appears above.',
		''
	);

	return out.join('\n');
}

const debug = (...parts) => {
	if (process.env.SLACK_DEBUG) console.error('[debug]', ...parts);
};

/**
 * Older Slack methods (conversations.*) only accept form-encoded arguments;
 * the canvas methods take JSON because their arguments are nested.
 */
async function slack(method, { query, json } = {}) {
	const token = process.env.SLACK_BOT_TOKEN;
	if (!token) throw new Error('SLACK_BOT_TOKEN is not set.');

	const url = new URL(`https://slack.com/api/${method}`);
	const init = { headers: { authorization: `Bearer ${token}` } };

	if (json) {
		init.method = 'POST';
		init.headers['content-type'] = 'application/json; charset=utf-8';
		init.body = JSON.stringify(json);
	} else {
		init.method = 'GET';
		url.search = new URLSearchParams(query).toString();
	}

	const res = await fetch(url, init);
	const body = await res.json();
	debug(method, '->', JSON.stringify(body).slice(0, 800));
	if (!body.ok) throw new Error(`Slack ${method} failed: ${body.error}`);
	return body;
}

async function ensureTitle(canvasId) {
	try {
		await slack('canvases.edit', {
			json: {
				canvas_id: canvasId,
				changes: [
					{ operation: 'rename', title_content: { type: 'markdown', markdown: CANVAS_TITLE } }
				]
			}
		});
	} catch (error) {
		console.error(`Warning: could not set the canvas title (${error.message}). Content is fine.`);
	}
}

/**
 * The canvas is standalone and owned by the bot, not a channel canvas. A channel
 * canvas inherits the channel's permissions, which means anyone who can post can
 * edit or detach it. Owning it keeps editing to the bot and the people listed in
 * SLACK_EDITOR_IDS, and keeps deletion to the bot alone.
 */
async function setAccess(canvasId, channelId, editors) {
	if (!channelId) throw new Error('Pass --channel <id> or set SLACK_CHANNEL_ID.');

	await slack('canvases.access.set', {
		json: { canvas_id: canvasId, channel_ids: [channelId], access_level: 'read' }
	});
	console.error(`Everyone in ${channelId} can now view the canvas.`);

	if (editors.length === 0) {
		console.error('No SLACK_EDITOR_IDS set, so only the bot can edit it.');
		return;
	}

	await slack('canvases.access.set', {
		json: { canvas_id: canvasId, user_ids: editors, access_level: 'write' }
	});
	console.error(`Write access granted to ${editors.join(', ')}.`);
}

async function publish(markdown) {
	const document_content = { type: 'markdown', markdown };

	if (!canvasOverride) {
		const created = await slack('canvases.create', {
			json: { title: CANVAS_TITLE, document_content }
		});
		console.error(
			`Created canvas ${created.canvas_id}. Next: set SLACK_CANVAS_ID to it, then run ` +
				'once with --setup-access to share it read-only with the channel.'
		);
		return { action: 'created', canvasId: created.canvas_id };
	}

	await slack('canvases.edit', {
		json: { canvas_id: canvasOverride, changes: [{ operation: 'replace', document_content }] }
	});
	await ensureTitle(canvasOverride);
	return { action: 'replaced', canvasId: canvasOverride };
}

if (setupAccess) {
	if (!canvasOverride) throw new Error('Pass --canvas <id> or set SLACK_CANVAS_ID.');
	await setAccess(canvasOverride, channel, EDITORS);
} else {
	const markdown = buildBoard(await fetchRepoState());

	if (dryRun) {
		console.log(markdown);
		console.error('\n--- dry run: nothing was sent to Slack ---');
	} else {
		const { action, canvasId } = await publish(markdown);
		console.error(`Canvas ${action} (${canvasId}).`);
	}
}
