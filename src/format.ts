import type { RepoCommits } from "./git.js";

export interface FormatOptions {
  since: string;
  author?: string;
}

export function formatDigest(
  repos: RepoCommits[],
  opts: FormatOptions,
): string {
  const lines: string[] = [];
  const heading = opts.author
    ? `# Standup — last ${opts.since} (${opts.author})`
    : `# Standup — last ${opts.since}`;
  lines.push(heading, "");

  if (repos.length === 0) {
    lines.push("_no repos configured_", "");
    return lines.join("\n");
  }

  for (const repo of repos) {
    lines.push(`## ${repo.name}`, "");
    if (repo.error) {
      lines.push(`_error: ${repo.error}_`, "");
      continue;
    }
    if (repo.commits.length === 0) {
      lines.push("_no commits_", "");
      continue;
    }
    for (const c of repo.commits) {
      lines.push(`- \`${c.hash}\` ${c.subject}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
