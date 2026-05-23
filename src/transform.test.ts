import { describe, it, expect } from "vitest";
import { parseGitLog } from "./git.js";
import { formatDigest } from "./format.js";
import { parseDuration } from "./duration.js";
import { parseConfig } from "./config.js";

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
    });
  });

  it("rejects a config with no repos", () => {
    expect(() => parseConfig("name = \"x\"\n")).toThrow(/repos/);
    expect(() => parseConfig("repos = []\n")).toThrow(/repos/);
  });
});
