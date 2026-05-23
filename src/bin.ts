#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./cli.js";

const argv = process.argv.slice(2);

if (argv.includes("--version") || argv.includes("-v")) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(here, "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
  process.stdout.write(`${pkg.version ?? "0.0.0"}\n`);
  process.exit(0);
}

run({ argv })
  .then((result) => {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exitCode);
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`standup: ${msg}\n`);
    process.exit(1);
  });
