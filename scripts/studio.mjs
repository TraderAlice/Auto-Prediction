import {
  assertStudioPortsAvailable,
  startStudioChildren,
  stopChild,
  superviseStudio,
} from "./studio-supervisor.mjs";
import {
  resolveStudioRuntimeConfig,
  studioChildEnvironment,
} from "./studio-runtime-config.mjs";

async function main() {
  const runtime = resolveStudioRuntimeConfig(process.env, process.argv.slice(2));
  await assertStudioPortsAvailable(runtime);
  const children = startStudioChildren({
    environment: studioChildEnvironment(runtime),
  });
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
