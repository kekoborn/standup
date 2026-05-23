import { execFileSync } from "node:child_process";

export interface Commit {
  hash: string;
  subject: string;
}

export interface RepoCommits {
  path: string;
  name: string;
  commits: Commit[];
  error?: string;
}

const FIELD_SEP = "\x1f";

export function parseGitLog(raw: string): Commit[] {
  if (!raw.trim()) return [];
  return raw
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const idx = line.indexOf(FIELD_SEP);
      if (idx === -1) return { hash: line, subject: "" };
      return { hash: line.slice(0, idx), subject: line.slice(idx + 1) };
    });
}

export interface ReadRepoLogOptions {
  repoPath: string;
  gitSince: string;
  author?: string;
}

export function readRepoLog(opts: ReadRepoLogOptions): Commit[] {
  const args = [
    "-C",
    opts.repoPath,
    "log",
    `--since=${opts.gitSince}`,
    `--pretty=format:%h${FIELD_SEP}%s`,
    "--no-merges",
  ];
  if (opts.author) args.push(`--author=${opts.author}`);
  const out = execFileSync("git", args, { encoding: "utf8" });
  return parseGitLog(out);
}
