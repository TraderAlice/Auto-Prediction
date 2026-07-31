import { resolve } from "node:path";

export const LOCAL_ENVIRONMENT_PATH = resolve(
  import.meta.dirname,
  "../../../.env.local",
);

export function loadLocalEnvironment(
  path = LOCAL_ENVIRONMENT_PATH,
): boolean {
  const inheritedEnvironment = { ...process.env };
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  Object.assign(process.env, inheritedEnvironment);
  return true;
}
