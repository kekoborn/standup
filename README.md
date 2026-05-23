# standup

A small CLI that turns your recent git history into a markdown standup digest.

## Status

v0 — single-user, local git only. Webhook posting (KEK-7) and LLM summaries are
out of scope for this release.

## Install

Requires Node.js 22+.

```sh
npm install -g @kek/standup
```

Or, from a checkout:

```sh
npm install
npm run build
npm link   # exposes the `standup` binary on your PATH
```

## First-run setup

Create `~/.config/standup/config.toml`:

```toml
# Optional: defaults to `git config user.email` if omitted.
name  = "Your Name"
email = "you@example.com"

# Required: list of local repo paths. `~` is expanded.
repos = [
  "~/code/api",
  "~/code/dashboard",
  "/srv/infra",
]
```

Then run:

```sh
standup                     # last 24h, to stdout
standup --since 3d          # last 3 days
standup --since 1w --copy   # last 1 week, copied to the clipboard
standup --config ./alt.toml # use a non-default config
```

### Output

```md
# Standup — last 24h (you@example.com)

## api

- `a1b2c3d` Fix flaky retry in queue worker
- `9f8e7d6` Add config flag for max retries

## dashboard

_no commits_
```

Pipe it anywhere: `standup | pbcopy`, `standup > standup.md`, etc.

### `--since` durations

`<N><unit>` where unit is `h` (hours), `d` (days), or `w` (weeks). Examples:
`24h`, `72h`, `3d`, `1w`.

### `--copy`

Copies the digest to your system clipboard.

- macOS: `pbcopy`
- Windows: `clip`
- Linux: `wl-copy`, then `xclip`, then `xsel` (first one found)

## Develop

```sh
npm install
npm test       # vitest
npm run lint
npm run typecheck
npm run build
```

## Out of scope (for now)

- Posting to Slack / Discord / other webhooks — tracked in KEK-7.
- LLM-generated commit summaries.
- Multi-user / team rollups.

## License

[MIT](./LICENSE)
