import type { ResolvedWebhook } from "./config.js";

// Slack accepts up to 40k chars in `text`, but anything past a few thousand
// renders awkwardly. We keep the plain path generous and only fall back to
// block-formatting if the digest is clearly too long for a single message.
const SLACK_PLAIN_MAX = 3500;

// Discord limits: content ≤ 2000, embed description ≤ 4096.
const DISCORD_CONTENT_MAX = 2000;
const DISCORD_EMBED_DESC_MAX = 4096;
const TRUNCATION_NOTICE = "\n\n_… digest truncated. Run locally for the full output._";

export interface SlackPayload {
  text: string;
  blocks?: Array<{ type: "section"; text: { type: "mrkdwn"; text: string } }>;
}

export interface DiscordPayload {
  content?: string;
  embeds?: Array<{ description: string }>;
}

export function buildSlackPayload(digest: string): SlackPayload {
  if (digest.length <= SLACK_PLAIN_MAX) {
    return { text: digest };
  }
  const chunks = chunk(digest, 2900);
  const fallback = firstLine(digest);
  return {
    text: fallback,
    blocks: chunks.map((c) => ({
      type: "section",
      text: { type: "mrkdwn", text: c },
    })),
  };
}

export function buildDiscordPayload(digest: string): DiscordPayload {
  if (digest.length <= DISCORD_CONTENT_MAX) {
    return { content: digest };
  }
  if (digest.length <= DISCORD_EMBED_DESC_MAX) {
    return { embeds: [{ description: digest }] };
  }
  const cap = DISCORD_EMBED_DESC_MAX - TRUNCATION_NOTICE.length;
  return {
    embeds: [{ description: digest.slice(0, cap) + TRUNCATION_NOTICE }],
  };
}

export interface PostOptions {
  fetchImpl?: typeof fetch;
}

export async function postWebhook(
  webhook: ResolvedWebhook,
  digest: string,
  opts: PostOptions = {},
): Promise<void> {
  const body =
    webhook.provider === "slack"
      ? buildSlackPayload(digest)
      : buildDiscordPayload(digest);
  const doFetch = opts.fetchImpl ?? fetch;

  let res: Response;
  try {
    res = await doFetch(webhook.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `failed to POST ${webhook.provider} webhook "${webhook.name}": ${(err as Error).message}`,
    );
  }

  if (!res.ok) {
    const detail = await safeReadText(res);
    const snippet = detail ? `: ${detail.slice(0, 200)}` : "";
    throw new Error(
      `${webhook.provider} webhook "${webhook.name}" returned HTTP ${res.status}${snippet}`,
    );
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return (await res.text()).trim();
  } catch {
    return "";
  }
}

function chunk(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) {
    out.push(s.slice(i, i + size));
  }
  return out;
}

function firstLine(s: string, max = 200): string {
  const nl = s.indexOf("\n");
  const head = nl === -1 ? s : s.slice(0, nl);
  return head.length <= max ? head : head.slice(0, max - 1) + "…";
}
