import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse as parseToml } from "smol-toml";

export interface Config {
  repos: string[];
  email?: string;
  name?: string;
}

export function defaultConfigPath(): string {
  return path.join(homedir(), ".config", "standup", "config.toml");
}

export function expandTilde(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return path.join(homedir(), p.slice(2));
  return p;
}

export function parseConfig(toml: string): Config {
  const parsed = parseToml(toml) as Record<string, unknown>;
  const reposRaw = parsed.repos;
  if (!Array.isArray(reposRaw) || reposRaw.length === 0) {
    throw new Error('config must define a non-empty `repos` array of paths.');
  }
  const repos = reposRaw.map((r, i) => {
    if (typeof r !== "string") {
      throw new Error(`config.repos[${i}] must be a string path.`);
    }
    return expandTilde(r);
  });
  const email = typeof parsed.email === "string" ? parsed.email : undefined;
  const name = typeof parsed.name === "string" ? parsed.name : undefined;
  return { repos, email, name };
}

export function loadConfig(file?: string): Config {
  const target = file ?? defaultConfigPath();
  if (!existsSync(target)) {
    throw new Error(
      `config not found at ${target}. Create it with at least:\n  repos = ["/path/to/repo"]`,
    );
  }
  return parseConfig(readFileSync(target, "utf8"));
}

export function resolveAuthor(cfg: Config): string | undefined {
  if (cfg.email) return cfg.email;
  try {
    const out = execFileSync("git", ["config", "user.email"], {
      encoding: "utf8",
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}
