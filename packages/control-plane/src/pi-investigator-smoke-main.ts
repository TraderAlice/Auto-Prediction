import { runPiInvestigatorSmoke } from "./pi-investigator-smoke.js";

try {
  const report = await runPiInvestigatorSmoke();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const diagnostic =
    error instanceof Error ? error.message : "pi investigator smoke failed";
  process.stderr.write(`${diagnostic}\n`);
  process.exitCode = 1;
}
