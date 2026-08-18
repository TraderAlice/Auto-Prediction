import { serializeWorkspaceRoute } from "./workspace-route.js";

export function reviewQueueNeedsKeyPath(input: {
  readonly reviewerConfigured: boolean;
  readonly estimatorsConfigured: boolean;
}): string | null {
  if (input.reviewerConfigured && input.estimatorsConfigured) {
    return null;
  }
  return serializeWorkspaceRoute("agents");
}
