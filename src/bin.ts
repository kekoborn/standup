#!/usr/bin/env node
import { run } from "./cli.js";

run({ argv: process.argv.slice(2) })
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
