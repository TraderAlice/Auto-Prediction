import { hashCanonical, type Hash } from "@pmh/domain";
import type { ManualAgentDispatchPreview } from "./agent-campaign-dispatcher.js";

export const AGENT_MANUAL_RUN_PREVIEW_BINDING_SCHEMA =
  "pmh.agent-manual-run-preview-binding.v1" as const;

export type AgentManualRunPreviewBinding = Readonly<{
  schemaVersion: typeof AGENT_MANUAL_RUN_PREVIEW_BINDING_SCHEMA;
  previewRef: Hash;
  taskId: Hash;
  taskPayloadHash: Hash;
  executionProfileId: Hash;
  executionProfileRevision: number;
  nextRunOrdinal: number;
  runBudget: ManualAgentDispatchPreview["executionProfile"]["runBudget"];
}>;

function bindingBody(
  preview: ManualAgentDispatchPreview,
): Omit<AgentManualRunPreviewBinding, "previewRef"> {
  return Object.freeze({
    schemaVersion: AGENT_MANUAL_RUN_PREVIEW_BINDING_SCHEMA,
    taskId: preview.task.taskId,
    taskPayloadHash: preview.task.taskPayloadHash,
    executionProfileId: preview.executionProfile.executionProfileId,
    executionProfileRevision: preview.executionProfile.revision,
    nextRunOrdinal: preview.nextRunOrdinal,
    runBudget: preview.executionProfile.runBudget,
  });
}

export function buildAgentManualRunPreviewBinding(
  preview: ManualAgentDispatchPreview,
): AgentManualRunPreviewBinding {
  const body = bindingBody(preview);
  return Object.freeze({
    ...body,
    previewRef: hashCanonical(body),
  });
}

export function currentManualRunPreviewBinding(
  preview: ManualAgentDispatchPreview,
  previewRef: unknown,
): AgentManualRunPreviewBinding {
  const current = buildAgentManualRunPreviewBinding(preview);
  if (typeof previewRef !== "string" || previewRef !== current.previewRef) {
    throw new Error("manual Agent run previewRef is stale or mismatched");
  }
  return current;
}
