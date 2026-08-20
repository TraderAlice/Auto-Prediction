#!/usr/bin/env node

import { runCli } from "./dispatch.js";

const envelope = await runCli(process.argv.slice(2));
process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
if (!envelope.ok) {
  process.exitCode = 2;
}
