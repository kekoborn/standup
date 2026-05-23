import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse as parseToml } from "smol-toml";

export interface Config {
  repos: string[];
  email?: string;
  name?: string;
  webhooks: Record<string, string>;
}

export type WebhookProvider = "slack" | "discord";

export interface ResolvedWebhook {
  name: string;
  provider: WebhookProvider;
  url: string;
  source: "env" | "config";
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
  const webhooks = parseWebhooks(parsed.webhooks);
  return { repos, email, name, webhooks };
}

function parseWebhooks(raw: unknown): Record<string, string> {
  if (raw === undefined) return {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("config.webhooks must be a table of provider.name = url entries.");
  }
  const out: Record<string, string> = {};
  flattenWebhooks(raw as Record<string, unknown>, "", out);
  return out;
}

function flattenWebhooks(
  node: Record<string, unknown>,
  prefix: string,
  out: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out[path] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenWebhooks(value as Record<string, unknown>, path, out);
    } else {
      throw new Error(`config.webhooks.${path} must be a string URL.`);
    }
  }
}

export function webhookEnvVarName(name: string): string {
  return `STANDUP_WEBHOOK_${name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`;
}

export function resolveWebhook(
  cfg: Config,
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedWebhook {
  const provider = providerFromName(name);
  const envVar = webhookEnvVarName(name);
  const envUrl = env[envVar];
  if (envUrl && envUrl.length > 0) {
    return { name, provider, url: envUrl, source: "env" };
  }
  const cfgUrl = cfg.webhooks[name];
  if (cfgUrl && cfgUrl.length > 0) {
    return { name, provider, url: cfgUrl, source: "config" };
  }
  throw new Error(
    `webhook "${name}" not configured. Set [webhooks] "${name}" = "..." in config, or export ${envVar}.`,
  );
}

function providerFromName(name: string): WebhookProvider {
  const provider = name.split(".", 1)[0]?.toLowerCase();
  if (provider === "slack" || provider === "discord") return provider;
  throw new Error(
    `webhook name "${name}" must start with a provider prefix (e.g. "slack.main" or "discord.team").`,
  );
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
