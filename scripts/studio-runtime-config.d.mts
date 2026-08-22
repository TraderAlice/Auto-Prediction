export type StudioRuntimeConfig = Readonly<{
  managed: boolean;
  host: string;
  httpPort: number;
  controlPlanePort: number;
  strictHttpPort: boolean;
  openBrowser: false;
}>;

export type StudioCliOverrides = Readonly<{
  host?: string;
  httpPort?: number;
  controlPlanePort?: number;
}>;

export function parseStudioCliOverrides(
  arguments_?: readonly string[],
): StudioCliOverrides;

export function resolveStudioRuntimeConfig(
  environment?: Readonly<Record<string, string | undefined>>,
  arguments_?: readonly string[],
): StudioRuntimeConfig;

export function studioChildEnvironment(
  runtime: StudioRuntimeConfig,
  environment?: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined>;
