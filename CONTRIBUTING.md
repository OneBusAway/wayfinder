# Contributing to Wayfinder

Thanks for your interest in contributing! Wayfinder is an open source project and we genuinely appreciate help from the community. Here's how to make the process smooth for everyone.

## Getting Started

Head over to the [README](README.md) for setup instructions — it's just `npm install`, copy `.env.example` to `.env`, and `npm run dev`. If you hit any issues getting things running, open a discussion or ask in the [OneBusAway Slack workspace](https://opentransitsoftwarefoundation.org/join-our-slack).

## Finding Something to Work On

Browse the [issues list](https://github.com/OneBusAway/wayfinder/issues) and look for anything tagged **good first issue** if you're new to the project. If you'd like to work on an issue, comment on it first so a maintainer can assign it to you; this avoids duplicate effort.

If you have an idea for something new, open an issue first to discuss it. This saves everyone time in case the feature doesn't align with the project's direction.

## Opening a PR

- **Link to the issue** your PR addresses (e.g., "Closes #123").
- **Keep PRs focused and small.** One feature or fix per PR. If you're touching multiple unrelated things, split them up.
- **Run formatting before pushing:** `npm run format` takes care of Prettier. Run `npm run lint` to catch anything ESLint flags.
- **Write a clear description** of what you changed and why. Reviewers shouldn't have to reverse-engineer your intent from the diff.
- **Make sure tests pass.** Run `npm run test` locally. If you're adding new functionality, add tests for it.

## Code Style

Prettier and ESLint are already configured — you don't need to make style decisions, just run the tools. The project uses tabs, single quotes, and a 100-character print width. For Svelte components, we use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) — follow the patterns you see in existing components rather than inventing new conventions.

## AI-Generated Code

Using AI tools is totally fine. But you own every line you submit — understand what it does, make sure it follows the patterns in the codebase, and test it properly. "The AI wrote it" isn't a valid response to a code review comment. Read it, verify it, make it yours.

## Communication

Be kind and respectful. Ask questions in issue comments or the [OneBusAway Slack](https://opentransitsoftwarefoundation.org/join-our-slack) — don't DM maintainers with general questions. If you're stuck on something, that's okay! Just ask. We'd rather help you get unstuck early than review a PR that went sideways.

## Review Timeline

Maintainers review PRs as time allows — this is volunteer-driven work. Please be patient. If you haven't heard anything after about a week, it's fine to leave a polite follow-up comment on the PR. We appreciate your patience and your contribution.
