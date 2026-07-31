import { loadLocalEnvironment } from "./local-environment.js";
import { startControlPlane } from "./server.js";

loadLocalEnvironment();
await startControlPlane();
