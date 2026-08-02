import { loadLocalEnvironment } from "./local-environment.js";
import { runRuleEvidenceClaimSmoke } from "./rule-evidence-claim-smoke.js";

loadLocalEnvironment();
try {
  const report = await runRuleEvidenceClaimSmoke();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${
    error instanceof Error ? error.message : "rule evidence claim smoke failed"
  }\n`);
  process.exitCode = 1;
}
