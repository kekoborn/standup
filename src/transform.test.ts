import { describe, it, expect } from "vitest";
import { parseGitLog } from "./git.js";
import { formatDigest } from "./format.js";
import { parseDuration } from "./duration.js";
import {
  parseConfig,
  resolveWebhook,
  webhookEnvVarName,
  type Config,
} from "./config.js";
import {
  buildSlackPayload,
  buildDiscordPayload,
  postWebhook,
} from "./webhook.js";

// Raw git output as produced by `git log --pretty=format:%h\x1f%s --no-merges`.
const RAW_LOG = [
  "a1b2c3d\x1fFix flaky retry in queue worker",
  "9f8e7d6\x1fAdd config flag for max retries",
  "1234567\x1fRefactor: split worker into modules",
].join("\n");

describe("parseGitLog", () => {
  it("splits hash and subject on the field separator", () => {
    expect(parseGitLog(RAW_LOG)).toEqual([
      { hash: "a1b2c3d", subject: "Fix flaky retry in queue worker" },
      { hash: "9f8e7d6", subject: "Add config flag for max retries" },
      { hash: "1234567", subject: "Refactor: split worker into modules" },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseGitLog("")).toEqual([]);
    expect(parseGitLog("\n  \n")).toEqual([]);
  });

  it("tolerates subjects containing colons and unicode", () => {
    const raw = "deadbee\x1ffeat: добавил поддержку Unicode 🚀";
    expect(parseGitLog(raw)).toEqual([
      { hash: "deadbee", subject: "feat: добавил поддержку Unicode 🚀" },
    ]);
  });
});

describe("formatDigest (git-log → markdown)", () => {
  it("produces a markdown digest grouped by repo", () => {
    const commits = parseGitLog(RAW_LOG);
    const md = formatDigest(
      [
        { path: "/repos/worker", name: "worker", commits },
        { path: "/repos/api", name: "api", commits: [] },
      ],
      { since: "24h", author: "dev@example.com" },
    );
    expect(md).toBe(
      [
        "# Standup — last 24h (dev@example.com)",
        "",
        "## worker",
        "",
        "- `a1b2c3d` Fix flaky retry in queue worker",
        "- `9f8e7d6` Add config flag for max retries",
        "- `1234567` Refactor: split worker into modules",
        "",
        "## api",
        "",
        "_no commits_",
        "",
      ].join("\n"),
    );
  });

  it("renders an error block when a repo failed to read", () => {
    const md = formatDigest(
      [
        {
          path: "/repos/broken",
          name: "broken",
          commits: [],
          error: "not a git repository",
        },
      ],
      { since: "3d" },
    );
    expect(md).toContain("## broken");
    expect(md).toContain("_error: not a git repository_");
    expect(md).toContain("# Standup — last 3d");
  });
});

describe("parseDuration", () => {
  it.each([
    ["24h", "24 hours ago"],
    ["1h", "1 hour ago"],
    ["3d", "3 days ago"],
    ["1d", "1 day ago"],
    ["2w", "2 weeks ago"],
  ])("parses %s → %s", (input, expected) => {
    expect(parseDuration(input).gitSince).toBe(expected);
  });

  it.each(["", "24", "10x", "0d", "1m"])("rejects %j", (bad) => {
    expect(() => parseDuration(bad)).toThrow(/invalid --since/);
  });
});

describe("parseConfig", () => {
  it("loads repos and identity from TOML", () => {
    const cfg = parseConfig(
      [
        'name = "Ruslan"',
        'email = "ruslan@example.com"',
        'repos = ["/tmp/a", "/tmp/b"]',
      ].join("\n"),
    );
    expect(cfg).toEqual({
      name: "Ruslan",
      email: "ruslan@example.com",
      repos: ["/tmp/a", "/tmp/b"],
      webhooks: {},
    });
  });

  it("rejects a config with no repos", () => {
    expect(() => parseConfig("name = \"x\"\n")).toThrow(/repos/);
    expect(() => parseConfig("repos = []\n")).toThrow(/repos/);
  });

  it("parses [webhooks] as flat provider.name → url map", () => {
    const cfg = parseConfig(
      [
        'repos = ["/tmp/a"]',
        "[webhooks]",
        'slack.main = "https://hooks.slack.com/services/AAA/BBB/CCC"',
        'discord.team = "https://discord.com/api/webhooks/123/abc"',
      ].join("\n"),
    );
    expect(cfg.webhooks).toEqual({
      "slack.main": "https://hooks.slack.com/services/AAA/BBB/CCC",
      "discord.team": "https://discord.com/api/webhooks/123/abc",
    });
  });

  it("rejects non-string webhook values", () => {
    expect(() =>
      parseConfig(
        ['repos = ["/tmp/a"]', "[webhooks]", "slack.main = 42"].join("\n"),
      ),
    ).toThrow(/webhooks\.slack\.main/);
  });
});

describe("webhookEnvVarName", () => {
  it("uppercases and replaces non-alphanumerics with _", () => {
    expect(webhookEnvVarName("slack.main")).toBe("STANDUP_WEBHOOK_SLACK_MAIN");
    expect(webhookEnvVarName("discord.team-ops")).toBe(
      "STANDUP_WEBHOOK_DISCORD_TEAM_OPS",
    );
  });
});

describe("resolveWebhook", () => {
  const cfg: Config = {
    repos: ["/tmp/a"],
    webhooks: { "slack.main": "https://hooks.slack.com/services/cfg" },
  };

  it("returns the config URL when no env override is set", () => {
    const w = resolveWebhook(cfg, "slack.main", {});
    expect(w).toEqual({
      name: "slack.main",
      provider: "slack",
      url: "https://hooks.slack.com/services/cfg",
      source: "config",
    });
  });

  it("env var overrides config", () => {
    const w = resolveWebhook(cfg, "slack.main", {
      STANDUP_WEBHOOK_SLACK_MAIN: "https://hooks.slack.com/services/env",
    });
    expect(w.url).toBe("https://hooks.slack.com/services/env");
    expect(w.source).toBe("env");
  });

  it("resolves env-only entries with no config row", () => {
    const w = resolveWebhook({ repos: ["/tmp/a"], webhooks: {} }, "discord.team", {
      STANDUP_WEBHOOK_DISCORD_TEAM: "https://discord.com/api/webhooks/env",
    });
    expect(w.provider).toBe("discord");
    expect(w.url).toBe("https://discord.com/api/webhooks/env");
  });

  it("throws when neither config nor env provides a URL", () => {
    expect(() => resolveWebhook(cfg, "slack.other", {})).toThrow(
      /STANDUP_WEBHOOK_SLACK_OTHER/,
    );
  });

  it("rejects names without a known provider prefix", () => {
    expect(() =>
      resolveWebhook({ repos: ["/tmp/a"], webhooks: {} }, "teams.main", {
        STANDUP_WEBHOOK_TEAMS_MAIN: "https://example.com",
      }),
    ).toThrow(/provider prefix/);
  });
});

describe("buildSlackPayload", () => {
  it("uses plain text for short digests", () => {
    const p = buildSlackPayload("# hi\n\nshort");
    expect(p).toEqual({ text: "# hi\n\nshort" });
    expect(p.blocks).toBeUndefined();
  });

  it("falls back to blocks for long digests", () => {
    const long = "x".repeat(4000);
    const p = buildSlackPayload(long);
    expect(p.text.length).toBeLessThan(long.length);
    expect(p.blocks?.length).toBeGreaterThan(1);
    expect(p.blocks?.every((b) => b.text.text.length <= 2900)).toBe(true);
  });
});

describe("buildDiscordPayload", () => {
  it("uses content for ≤2000 chars", () => {
    const p = buildDiscordPayload("hello");
    expect(p).toEqual({ content: "hello" });
  });

  it("uses an embed when content would exceed 2000", () => {
    const text = "a".repeat(2500);
    const p = buildDiscordPayload(text);
    expect(p.content).toBeUndefined();
    expect(p.embeds?.[0]?.description).toBe(text);
  });

  it("truncates with a notice when the embed description would exceed 4096", () => {
    const text = "b".repeat(5000);
    const p = buildDiscordPayload(text);
    const desc = p.embeds?.[0]?.description ?? "";
    expect(desc.length).toBeLessThanOrEqual(4096);
    expect(desc).toMatch(/digest truncated/);
  });
});

describe("postWebhook", () => {
  it("POSTs JSON and resolves on 2xx", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body ?? "{}")),
      });
      return new Response("ok", { status: 200 });
    };
    await postWebhook(
      {
        name: "slack.main",
        provider: "slack",
        url: "https://example.com/hook",
        source: "config",
      },
      "hello",
      { fetchImpl: fakeFetch as typeof fetch },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.com/hook");
    expect(calls[0]?.body).toEqual({ text: "hello" });
  });

  it("throws on non-2xx with HTTP status in message", async () => {
    const fakeFetch = async () =>
      new Response("invalid_token", { status: 403 });
    await expect(
      postWebhook(
        {
          name: "slack.main",
          provider: "slack",
          url: "https://example.com/hook",
          source: "config",
        },
        "hi",
        { fetchImpl: fakeFetch as typeof fetch },
      ),
    ).rejects.toThrow(/HTTP 403/);
  });

  it("throws on network failure with the underlying message", async () => {
    const fakeFetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(
      postWebhook(
        {
          name: "discord.team",
          provider: "discord",
          url: "https://example.com/hook",
          source: "env",
        },
        "hi",
        { fetchImpl: fakeFetch as typeof fetch },
      ),
    ).rejects.toThrow(/ECONNREFUSED/);
  });
});
