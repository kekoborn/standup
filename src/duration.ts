const UNITS: Record<string, string> = {
  h: "hour",
  d: "day",
  w: "week",
};

export interface ParsedDuration {
  raw: string;
  gitSince: string;
}

export function parseDuration(input: string): ParsedDuration {
  const m = /^(\d+)([hdw])$/.exec(input.trim());
  if (!m) {
    throw new Error(
      `invalid --since value: "${input}". Use forms like 24h, 3d, 1w.`,
    );
  }
  const n = Number(m[1]);
  if (n === 0) {
    throw new Error(`invalid --since value: "${input}". Must be > 0.`);
  }
  const word = UNITS[m[2]];
  const gitSince = `${n} ${word}${n === 1 ? "" : "s"} ago`;
  return { raw: input, gitSince };
}
