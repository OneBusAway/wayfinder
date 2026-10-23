# Slack contributor board

An auto-updating board in Slack that shows what needs a maintainer, what is free
to pick up, and what shipped recently. It is one GitHub Actions workflow and one
dependency-free Node script. There is no server, no hosting cost, and nothing to
operate.

- Script: [`scripts/slack-board.mjs`](../scripts/slack-board.mjs)
- Workflow: [`.github/workflows/slack-board.yml`](../.github/workflows/slack-board.yml)

## Why it exists

In a volunteer project the bottleneck is review latency, not issue discovery.
Two specific gaps caused PRs to sit for weeks:

1. **Contributors cannot request reviewers.** On a public repository only people
   with write or triage access can assign a reviewer. Outside contributors have
   no such button, so their PRs never appear in a maintainer's "Review requested"
   filter. They are invisible unless somebody goes looking.
2. **GitHub never resurfaces a PR after the author responds.** Once changes are
   requested the PR reads "Changes requested" forever, even after the author
   pushes a fix. The maintainer thinks they are waiting on the contributor; the
   contributor thinks they are waiting on the maintainer. Nobody moves.

The board fixes both by deriving state from submitted reviews rather than from
requested reviewers, and by giving "author has pushed since changes were
requested" its own section.

## How a run works

1. GitHub spins up a fresh Ubuntu VM.
2. It checks out the repo and installs Node. There are no npm dependencies.
3. `scripts/slack-board.mjs` runs: one GraphQL call to GitHub, then two or three
   Slack calls.
4. The VM is destroyed. Nothing persists between runs — which is why the canvas
   ID is stored in repo configuration rather than discovered each time.

Triggered hourly by cron, and on demand from the Actions tab.

## PR states

Draft PRs are excluded. Everything else lands in exactly one bucket:

| Section               | Rule                                           | Blocked on  |
| --------------------- | ---------------------------------------------- | ----------- |
| Needs a first review  | No human review submitted                      | Maintainers |
| Needs a re-review     | Changes requested, author pushed since         | Maintainers |
| Needs a decision      | Only comment-reviews, no approval or rejection | Maintainers |
| Ready to merge        | Approved, nothing blocking                     | Maintainers |
| Waiting on the author | Changes requested, nothing pushed in 7+ days   | Contributor |

Two details that matter:

- **State is computed from the raw review list, not `reviewDecision`.** That
  field depends on branch-protection settings and is `null` on repos without
  required reviews.
- **Bot reviewers are ignored.** CodeRabbit comments on everything; counting it
  as "somebody looked" would empty the first-review queue and defeat the whole
  purpose. Bots are matched by `__typename`, a `[bot]` suffix, or the
  `BOT_REVIEWERS` list at the top of the script.

## Slack setup

Create the app from a manifest rather than clicking scopes together:

```yaml
display_information:
  name: Wayfinder Board
  description: Keeps the Wayfinder contributor board up to date.
  background_color: '#1a4d2e'
features:
  bot_user:
    display_name: Wayfinder Board
    always_online: false
oauth_config:
  scopes:
    bot:
      - canvases:read
      - canvases:write
      - chat:write
      - channels:read
      - groups:read
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

| Scope            | Why                                                  |
| ---------------- | ---------------------------------------------------- |
| `canvases:write` | Create and replace the canvas                        |
| `canvases:read`  | Reserved for section lookups; harmless to keep       |
| `channels:read`  | Read channel info for a **public** channel           |
| `groups:read`    | Same, for a **private** channel — needed for testing |
| `chat:write`     | Reserved for the future event posts                  |

The app must be invited to the channel: `/invite @Wayfinder Board`.

## Canvas behaviour

- A channel can hold **exactly one** channel canvas. `conversations.canvases.create`
  fails with `channel_canvas_already_exists` if one is already there.
- `canvases.edit` with `operation: replace` and **no** `section_id` replaces the
  entire document in one call. That is what this script does, so the script owns
  the whole canvas and any human edit is overwritten on the next run. The board
  says so in its header line.
- A canvas in a public channel is **viewable by everyone in the workspace**. By
  default anyone who can post in the channel can also edit it. Restricting that
  is a paid-plan feature; where it is unavailable, the "edits are overwritten"
  note is the mitigation.
- The canvas title is set separately via `operation: rename`, because
  `conversations.canvases.create` does not accept one. Slack renders that title
  above the document, so the markdown deliberately starts with no `#` heading.
- **Do not rely on auto-detecting the canvas ID.** `conversations.info` does not
  reliably report `properties.canvas`, and when it does not, the script would
  create a second canvas. Store the ID explicitly.

## Slack API encoding

A trap worth knowing: older methods (`conversations.*`) accept only
form-encoded arguments and reject a JSON body with `invalid_arguments`. The
canvas methods take JSON because their arguments are nested. The script's
`slack()` helper sends GET with query params by default and JSON only where
required.

## Configuration

Repo → **Settings** → **Secrets and variables** → **Actions**.

| Name               | Tab       | Example       | Secret? |
| ------------------ | --------- | ------------- | ------- |
| `SLACK_BOT_TOKEN`  | Secrets   | `xoxb-…`      | **Yes** |
| `SLACK_CHANNEL_ID` | Variables | `C0AKW41FU7N` | No      |
| `SLACK_CANVAS_ID`  | Variables | `F09…`        | No      |

`GITHUB_TOKEN` is injected by Actions automatically; nothing to configure.

Locally the script falls back to `gh auth token`, so `--dry-run` works with no
setup at all.

## Rollout procedure

Each step is reversible and nothing touches the public channel until step 5.

1. Create the Slack app, install it, invite it to a **private test channel**.
2. `node scripts/slack-board.mjs --dry-run` — prints markdown, calls nothing.
3. Run it against the test channel. Verify tables render and that a second run
   says `replaced`, not `created`.
4. Capture the canvas ID the first run prints and pass `--canvas` from then on.
5. Invite the bot to the real channel, create the canvas there, run it by hand
   for a day or two.
6. Add the secret and variables, merge the workflow with `workflow_dispatch`
   only, and trigger it by hand.
7. Add the `schedule` trigger once a manual run has succeeded.

## Operating it

**Kill switches**, any one of which stops everything immediately:

- Disable the workflow in the Actions tab (no commit needed)
- Remove the app from the channel
- Revoke the bot token in the Slack app settings

**Failure modes:**

| Symptom                 | Cause                                                             | Fix                           |
| ----------------------- | ----------------------------------------------------------------- | ----------------------------- |
| `missing_scope`         | Scope added but app not reinstalled                               | Reinstall, re-copy token      |
| `channel_not_found`     | Bot not in the channel, or private channel without `groups:read`  | Invite the bot; add the scope |
| `invalid_arguments`     | JSON sent to a form-encoded method                                | Use query params              |
| A second canvas appears | `SLACK_CANVAS_ID` not set                                         | Set the variable              |
| Workflow silently stops | Scheduled workflows are disabled after 60 days of repo inactivity | Push anything, re-enable      |

The workflow is independent of the build, so a Slack outage fails this workflow
alone and cannot turn CI red.

## Making it live

Cron is a floor, not a ceiling. To react within about a minute, add event
triggers alongside the hourly schedule:

- `pull_request_target` — opened, closed, reopened, synchronize,
  ready_for_review, converted_to_draft
- `pull_request_review` — submitted, dismissed
- `issues` — opened, closed, labeled, unlabeled, assigned, unassigned

Keep the hourly cron as a backstop, because the age columns change with the
clock even when nothing happens on GitHub.

**Security note:** a `pull_request` run triggered from a fork receives no
secrets, so first-time-contributor automation would silently never fire for
exactly the people it is meant for. `pull_request_target` runs in the base
repo's context and does have secrets — but it must never check out or execute
the fork's code. For a job that reads event metadata and calls Slack that is
trivially satisfied, and the workflow file should say so, because the next
person to edit it will want to add a checkout step.

## Reusing this elsewhere

The script is deliberately repo-agnostic. To point it at another project:

- Set `BOARD_REPO` (defaults to `OneBusAway/wayfinder`).
- Adjust `CANVAS_TITLE`, `GOOD_FIRST_ISSUE`, `STALE_AUTHOR_DAYS`,
  `MERGED_WINDOW_DAYS`, `MERGED_SHOWN` and `BOT_REVIEWERS` at the top of the file.
- Edit the "Who to ping" block at the bottom of `buildBoard()`.

Everything else — the Slack app, the scopes, the workflow, the rollout — is the
same.

## Measuring whether it works

Track one number: median days from PR opened to first review. If it does not
move after a month, delete the workflow. Being willing to remove it is what
makes this a cheap experiment rather than another thing to maintain.
