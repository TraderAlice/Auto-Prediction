import {
  assertPortAvailable,
  startStudioChildren,
  stopChild,
  superviseStudio,
} from "./studio-supervisor.mjs";

async function main() {
  await assertPortAvailable();
  const children = startStudioChildren();
  let shuttingDown = false;

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      for (const { child } of children) stopChild(child, signal);
    });
  }

  return superviseStudio(children);
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`[studio] ${error.message}\n`);
  process.exitCode = 1;
}
