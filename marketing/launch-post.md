# Show HN: standup — turn your git log into a markdown standup digest

**Draft — 380 words. Owner: Hire #2 (designer/marketing). Polish copy, swap in real asciinema, post when ready.**

---

Every async team I've worked on has the same low-grade friction: someone has to write the standup. You did the work, you remember most of what you shipped, but at 9:02am you're staring at a Slack box trying to reconstruct yesterday from memory and a half-finished PR.

I built `standup` because the source of truth is already there: my git log. I just wanted it formatted like a standup, in under a second, with one command.

```
$ standup --since 24h

# Standup — last 24h (you@example.com)

## api
- `a1b2c3d` Fix flaky retry in queue worker
- `9f8e7d6` Add config flag for max retries

## dashboard
- `4c5d6e7` Migrate billing table to typed columns
```

That's it. That's the whole product.

### What it does

- Reads `git log` from every repo you list in `~/.config/standup/config.toml`.
- Filters to commits authored by you (matched by name or email).
- Groups by repo, sorts newest first, renders to markdown.
- Writes to stdout, a file, or your clipboard (`--copy` shells out to `pbcopy` / `clip` / `wl-copy`).

That's a few hundred lines of TypeScript, tested with vitest, packaged as a single `standup` binary on npm. Node 22+, MIT.

### What it deliberately doesn't do

- **No LLM.** Same commits in, same digest out. I want my standup deterministic and free.
- **No SaaS.** It reads files on your disk. There is no server, no account, no token bill.
- **No webhook posting** in v0 — I'd rather you paste it into Slack yourself than ship a half-baked integration. (That's the next ticket.)
- **No team rollups.** It's a single-user tool. If two of you want a combined digest, run it twice and `cat` them.

### Why post this

Mostly: I've shipped a dozen of these "I'll write a CLI for it" tools over the years and the ones that survived were the ones I told other people about early. So — here you go. Issues, PRs, and "this would be 10x more useful if you also did X" comments all welcome.

GitHub: https://github.com/kekoborn/standup
Site: https://kekoborn.github.io/standup/
Install: `npm install -g @kek/standup`
