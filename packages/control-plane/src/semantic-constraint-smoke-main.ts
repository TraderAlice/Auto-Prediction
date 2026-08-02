import { loadLocalEnvironment } from "./local-environment.js";
import { runSemanticConstraintSmoke } from "./semantic-constraint-smoke.js";

loadLocalEnvironment();
try {
  const report = await runSemanticConstraintSmoke();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "semantic constraint smoke failed"}\n`);
  process.exitCode = 1;
}
