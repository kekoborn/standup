# standup

A small CLI that turns your recent git history into a markdown standup digest.

## Status

v0 — single-user, local git only. Optional Slack/Discord posting via webhook.
LLM summaries are still out of scope.

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
standup                          # last 24h, to stdout
standup --since 3d               # last 3 days
standup --since 1w --copy        # last 1 week, copied to the clipboard
standup --post slack.main        # POST to a configured Slack webhook
standup --post discord.team      # POST to a configured Discord webhook
standup --config ./alt.toml      # use a non-default config
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

### `--post <name>`

Posts the markdown digest to a configured incoming webhook. Names are
`<provider>.<label>`, where provider is `slack` or `discord`:

```toml
# ~/.config/standup/config.toml
[webhooks]
"slack.main"    = "https://hooks.slack.com/services/XXX/YYY/ZZZ"
"discord.team"  = "https://discord.com/api/webhooks/123/abc"
```

- Slack: posted as plain `text` (Slack renders markdown). For very long
  digests, falls back to a multi-`section` `blocks` message.
- Discord: posted as `content` while it fits in 2000 chars; otherwise sent
  as an embed `description` (up to 4096 chars). Digests that exceed both
  limits are truncated with an in-message notice.
- On HTTP errors (non-2xx or network failure), the CLI writes a clear
  message to stderr and exits with a non-zero status code.

#### Webhook URLs are secrets

- **Never** commit them. Keep them in your local `config.toml` (chmod 600)
  or in environment variables.
- **Never** put them in `package.json` scripts or any other file that lives
  in version control — those get printed to logs and screen-shared.
- **Never** pass them on the command line — `--post` takes only the *name*
  of the webhook, never the URL itself. Shell history and process listings
  would otherwise leak the secret.

#### Env-var override

Any configured webhook URL can be overridden with an environment variable.
The name is `STANDUP_WEBHOOK_<NAME>`, where `<NAME>` is the webhook name
uppercased with every non-alphanumeric character replaced by `_`:

| Webhook name      | Env var                          |
| ----------------- | -------------------------------- |
| `slack.main`      | `STANDUP_WEBHOOK_SLACK_MAIN`     |
| `discord.team`    | `STANDUP_WEBHOOK_DISCORD_TEAM`   |
| `slack.team-ops`  | `STANDUP_WEBHOOK_SLACK_TEAM_OPS` |

The env var is also enough on its own — you can use a webhook that isn't
listed in the config file at all:

```sh
export STANDUP_WEBHOOK_SLACK_MAIN="https://hooks.slack.com/services/XXX/YYY/ZZZ"
standup --post slack.main
```

## Develop

```sh
npm install
npm test       # vitest
npm run lint
npm run typecheck
npm run build
```

## Out of scope (for now)

- LLM-generated commit summaries.
- Multi-user / team rollups.

## License

[MIT](./LICENSE)
