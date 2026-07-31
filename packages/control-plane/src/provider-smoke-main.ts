import { loadLocalEnvironment } from "./local-environment.js";
import { runModelProviderSmoke } from "./provider-smoke.js";

loadLocalEnvironment();
try {
  const report = await runModelProviderSmoke();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const diagnostic =
    error instanceof Error ? error.message : "provider smoke failed";
  process.stderr.write(`${diagnostic}\n`);
  process.exitCode = 1;
}
