import path from "node:path";
import { parseArgs } from "node:util";
import { loadConfig, resolveAuthor, resolveWebhook } from "./config.js";
import { parseDuration } from "./duration.js";
import { readRepoLog, type RepoCommits } from "./git.js";
import { formatDigest } from "./format.js";
import { copyToClipboard } from "./clipboard.js";
import { postWebhook } from "./webhook.js";

const HELP = `standup — async standup digest from local git history

Usage:
  standup [--since <duration>] [--copy | --post <name>] [--config <path>]

Options:
  --since <duration>   Time window (e.g. 24h, 3d, 1w). Default: 24h.
  --copy               Copy markdown digest to clipboard instead of stdout.
  --post <name>        Post digest to the named webhook (e.g. slack.main,
                       discord.team). URL is read from config or the
                       STANDUP_WEBHOOK_<NAME> env var — never accepted on
                       the command line.
  --config <path>      Config file path. Default: ~/.config/standup/config.toml.
  -h, --help           Show this help.
`;

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  argv: string[];
  env?: NodeJS.ProcessEnv;
}

export async function run(opts: RunOptions): Promise<RunResult> {
  let parsed;
  try {
    parsed = parseArgs({
      args: opts.argv,
      options: {
        since: { type: "string", default: "24h" },
        copy: { type: "boolean", default: false },
        post: { type: "string" },
        config: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (e) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${(e as Error).message}\n\n${HELP}`,
    };
  }

  if (parsed.values.help) {
    return { exitCode: 0, stdout: HELP, stderr: "" };
  }

  const postName = parsed.values.post as string | undefined;
  if (postName !== undefined && parsed.values.copy) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "--copy and --post are mutually exclusive.\n",
    };
  }

  const sinceRaw = parsed.values.since as string;
  const duration = parseDuration(sinceRaw);
  const cfg = loadConfig(parsed.values.config as string | undefined);
  const author = resolveAuthor(cfg);

  const repos: RepoCommits[] = cfg.repos.map((repoPath) => {
    const name = path.basename(repoPath.replace(/\/+$/, ""));
    try {
      const commits = readRepoLog({
        repoPath,
        gitSince: duration.gitSince,
        author,
      });
      return { path: repoPath, name, commits };
    } catch (err) {
      return {
        path: repoPath,
        name,
        commits: [],
        error: (err as Error).message.split("\n")[0],
      };
    }
  });

  const md = formatDigest(repos, { since: sinceRaw, author });

  if (parsed.values.copy) {
    copyToClipboard(md);
    return {
      exitCode: 0,
      stdout: "",
      stderr: `copied ${md.length} chars to clipboard.\n`,
    };
  }

  if (postName !== undefined) {
    let webhook;
    try {
      webhook = resolveWebhook(cfg, postName, opts.env ?? process.env);
    } catch (err) {
      return { exitCode: 1, stdout: "", stderr: `${(err as Error).message}\n` };
    }
    try {
      await postWebhook(webhook, md);
    } catch (err) {
      return { exitCode: 1, stdout: "", stderr: `${(err as Error).message}\n` };
    }
    return {
      exitCode: 0,
      stdout: "",
      stderr: `posted ${md.length} chars to ${webhook.provider} webhook "${webhook.name}" (from ${webhook.source}).\n`,
    };
  }

  return { exitCode: 0, stdout: md, stderr: "" };
}
