import { runOpenAiProviderSmoke } from "./provider-smoke.js";

try {
  const report = await runOpenAiProviderSmoke();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const diagnostic =
    error instanceof Error ? error.message : "provider smoke failed";
  process.stderr.write(`${diagnostic}\n`);
  process.exitCode = 1;
}
