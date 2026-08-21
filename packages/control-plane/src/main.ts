import { loadLocalEnvironment } from "./local-environment.js";
import { startControlPlane } from "./server.js";
import { resolveStudioRuntimeConfig } from "../../../scripts/studio-runtime-config.mjs";

loadLocalEnvironment();
const runtime = resolveStudioRuntimeConfig();
await startControlPlane(runtime.controlPlanePort, runtime.host);
