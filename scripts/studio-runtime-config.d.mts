export type StudioRuntimeConfig = Readonly<{
  managed: boolean;
  host: string;
  httpPort: number;
  controlPlanePort: number;
  strictHttpPort: boolean;
  openBrowser: false;
}>;

export function resolveStudioRuntimeConfig(
  environment?: Readonly<Record<string, string | undefined>>,
): StudioRuntimeConfig;
