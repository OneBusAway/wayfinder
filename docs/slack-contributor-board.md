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
      - canvases:write
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

One scope. `canvases:write` covers creating the canvas, replacing its contents,
renaming it, and setting who can read or write it. The script makes no other
kind of Slack call, so there is nothing else to grant.

`chat:write` is needed only once the event posts ship. `channels:read` and
`groups:read` were needed by an earlier design that looked up a channel canvas;
they are not needed now.

The bot does not need to be a member of the channel. Access is granted to the
canvas directly.

## Canvas ownership, and why it is not a channel canvas

The first version used a **channel canvas**, created with
`conversations.canvases.create`. That turned out to be the wrong model. A
channel canvas inherits the channel's permissions, so in a public channel
anyone who can post can also edit it, change its sharing settings, or detach it
from the channel. That is exactly what happened: a contributor changed the
access settings, and the board ended up view-only for its own maintainer.

The board now uses a **standalone canvas created by the bot**, which makes the
bot its owner:

- Only the bot and the users listed in `SLACK_EDITOR_IDS` can edit it.
- Everyone in the channel gets read access, granted explicitly.
- Nobody but the owner can delete it.

Access is set in code, not by clicking, so it is reproducible and reviewable:

```bash
node scripts/slack-board.mjs --setup-access \
  --canvas F0... --channel C0... --editors U06...,U0F...
```

That makes two `canvases.access.set` calls: one granting the channel `read`,
one granting the named users `write`. Run it once at setup, and again if the
editor list changes.

Other things worth knowing:

- `canvases.edit` with `operation: replace` and **no** `section_id` replaces the
  entire document in one call. The script owns the whole canvas, so edits made
  in Slack are overwritten on the next run. The board says so in its header.
- The canvas title is set separately via `operation: rename`, because the create
  call's title is not always kept. Slack renders that title above the document,
  so the markdown deliberately starts with no `#` heading.
- A standalone canvas is **not a channel tab.** Add it to the channel as a
  bookmark so it has a permanent, visible home. Keep its URL
  (`https://<workspace>.slack.com/docs/<TEAM_ID>/<CANVAS_ID>`) somewhere safe —
  it is the one handle no UI click can remove. `auth.test` returns the team ID.
- Standalone canvases require a paid Slack plan. Probe with `canvases.create`
  before committing to this design; free teams get an error.
- **Always set `SLACK_CANVAS_ID`.** Without it the script creates a new canvas
  every run.

## Configuration

Repo → **Settings** → **Secrets and variables** → **Actions**.

| Name               | Tab       | Example     | Secret? |
| ------------------ | --------- | ----------- | ------- |
| `SLACK_BOT_TOKEN`  | Secrets   | `xoxb-…`    | **Yes** |
| `SLACK_CANVAS_ID`  | Variables | `F0…`       | No      |
| `SLACK_CHANNEL_ID` | Variables | `C0…`       | No      |
| `SLACK_EDITOR_IDS` | Variables | `U06…,U0F…` | No      |

Only the token is secret. The IDs go in Variables, where you can read them back
— secrets are write-only, which makes debugging miserable.

`SLACK_CHANNEL_ID` and `SLACK_EDITOR_IDS` are used only by `--setup-access`; the
hourly run needs just the token and the canvas ID. `GITHUB_TOKEN` is injected by
Actions automatically.

Locally the script falls back to `gh auth token`, so `--dry-run` works with no
setup at all.

## Rollout procedure

Each step is reversible and nothing is visible to the channel until step 5.

1. Create the Slack app and install it.
2. `node scripts/slack-board.mjs --dry-run` — prints markdown, calls nothing.
3. `node scripts/slack-board.mjs` with no canvas ID — creates a bot-owned canvas
   and prints its ID. At this point only the bot can see it.
4. Run again with `--canvas <id>` twice. Both should report `replaced`.
5. `--setup-access` to grant the channel read and the maintainers write, then add
   the canvas to the channel as a bookmark.
6. Add the secret and variables, then merge the workflow.
7. Trigger it by hand from the Actions tab. This is the first run with the repo
   secret rather than a shell variable, so it is where a mistyped variable name
   or a token with a stray space shows up.

The workflow ships with `schedule` already enabled, because steps 1–5 leave
little for the first scheduled run to get wrong and the kill switch is one click
in the Actions tab. If you would rather not have cron fire before you have
watched a manual run, drop the two `schedule` lines for the first merge and add
them back afterwards.

## Operating it

**Kill switches**, any one of which stops everything immediately:

- Disable the workflow in the Actions tab (no commit needed)
- Remove the app from the channel
- Revoke the bot token in the Slack app settings

**Failure modes:**

| Symptom                                                     | Cause                                                             | Fix                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `missing_scope`                                             | Scope added but app not reinstalled                               | Reinstall, re-copy token                   |
| `channel_not_found`                                         | Bot not in the channel, or private channel without `groups:read`  | Invite the bot; add the scope              |
| `invalid_arguments`                                         | A method that wants form encoding was sent JSON                   | Switch that call to GET with query params  |
| A second canvas appears, or `channel_canvas_already_exists` | `SLACK_CANVAS_ID` not set, so the script tried to create one      | Set the variable to the existing canvas ID |
| Workflow silently stops                                     | Scheduled workflows are disabled after 60 days of repo inactivity | Push anything, re-enable                   |

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
