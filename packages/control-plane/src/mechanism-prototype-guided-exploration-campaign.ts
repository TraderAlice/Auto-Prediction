import { hashCanonical, type Hash } from "@pmh/domain";
import {
  assertAgentCampaignSelectionBinding,
  type AgentCampaign,
  type AgentCampaignSelectionBinding,
  type AgentExecutionSnapshot,
  type AgentRun,
  type ExecutionProfile,
  type WorkloadRoute,
} from "./agent-execution-substrate.js";
import type { ExecutionCapabilityProjection } from "./agent-runtime-adapter.js";
import type {
  MechanismPrototypeExplorationInputRevision,
  MechanismPrototypeExplorationLens,
} from "./mechanism-prototype-guided-exploration.js";

export const MECHANISM_PROTOTYPE_EXPLORATION_SELECTION_PROTOCOL =
  "MECHANISM_PROTOTYPE_EXPLORATION_SELECTION_V1" as const;

export type MechanismPrototypeExplorationCampaignPreview = Readonly<{
  schemaVersion: "pmh.mechanism-prototype-exploration-campaign-preview.v1";
  previewIdentity: Hash;
  campaignKey: string;
  workloadRoute: WorkloadRoute;
  executionProfile: ExecutionProfile;
  capability: ExecutionCapabilityProjection;
  selectionBinding: AgentCampaignSelectionBinding;
  taskIds: readonly Hash[];
  lensIds: readonly Hash[];
  axes: readonly string[];
  schedule: Readonly<{ kind: "MANUAL_ONLY"; intervalMs: null }>;
  taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE";
  budget: Readonly<{
    maximumConcurrentRuns: 1;
    maximumModelInvocations: 16;
    maximumInputTokens: "500000";
    maximumOutputTokens: "20000";
    maximumWallClockMs: 600000;
  }>;
  creationEligible: boolean;
  dispatchEligible: boolean;
  diagnostic: string;
  providerRequestsStarted: 0;
  modelInvocationsStarted: 0;
  automaticDispatch: false;
  semanticDecisionAuthority: false;
  authority: "CAMPAIGN_PROPOSAL_ONLY";
}>;

function bindingFor(lens: MechanismPrototypeExplorationLens) {
  const input = lens.currentInputRevision;
  return Object.freeze({
    taskId: lens.task.taskId,
    workFamilyRef: `mechanism-prototype-exploration:${lens.lensId}`,
    selectionActionRef: input.inputRevisionId,
    selectionActionKind: `EXPLORE_MECHANISM_PROTOTYPE_${lens.axis}`,
    inputRevisionKind: "MECHANISM_PROTOTYPE_EXPLORATION_INPUT",
    inputRevisionId: input.inputRevisionId,
    exactInputHash: hashCanonical(input),
    semanticInputIdentity: input.semanticInputIdentity,
  });
}

export function buildMechanismPrototypeExplorationCampaignSelectionBinding(
  lenses: readonly MechanismPrototypeExplorationLens[],
): AgentCampaignSelectionBinding {
  const taskBindings = Object.freeze(lenses.map(bindingFor)
    .sort((left, right) => left.taskId.localeCompare(right.taskId)));
  return assertAgentCampaignSelectionBinding(Object.freeze({
    schemaVersion: "pmh.agent-campaign-selection-binding.v1" as const,
    selectionProtocol: MECHANISM_PROTOTYPE_EXPLORATION_SELECTION_PROTOCOL,
    selectionIdentity: hashCanonical(taskBindings),
    selectionPolicyIdentity: hashCanonical({
      schemaVersion: "pmh.mechanism-prototype-exploration-selection-policy.v1",
      maximumTasks: 1,
      semanticInputDeduplication: true,
      exactCorpusRevisionRequired: true,
      automaticDispatch: false,
    }),
    taskBindings,
  }));
}

export function resolveMechanismPrototypeExplorationCampaignInput(input: Readonly<{
  taskId: Hash;
  run: AgentRun;
  campaigns: readonly AgentCampaign[];
  currentLenses: readonly MechanismPrototypeExplorationLens[];
  loadInput?: (revisionId: Hash) => MechanismPrototypeExplorationInputRevision | null;
}>): MechanismPrototypeExplorationInputRevision {
  const current = input.currentLenses.find((item) => item.task.taskId === input.taskId);
  if (input.run.authorization.kind !== "CAMPAIGN") {
    if (current === undefined) throw new Error("mechanism exploration current lens is unavailable");
    return input.loadInput?.(current.currentInputRevision.inputRevisionId) ??
      current.currentInputRevision;
  }
  const campaign = input.campaigns.find((item) =>
    item.campaignId === input.run.authorization.campaignId
  );
  if (campaign === undefined || campaign.schemaVersion === "pmh.agent-campaign.v1" ||
      campaign.selectionBinding.selectionProtocol !==
        MECHANISM_PROTOTYPE_EXPLORATION_SELECTION_PROTOCOL) {
    throw new Error("mechanism exploration campaign has no immutable selection binding");
  }
  const binding = campaign.selectionBinding.taskBindings.find((item) =>
    item.taskId === input.taskId
  );
  if (binding === undefined ||
      binding.inputRevisionKind !== "MECHANISM_PROTOTYPE_EXPLORATION_INPUT") {
    throw new Error("mechanism exploration campaign exact input binding is unavailable");
  }
  const retained = input.loadInput?.(binding.inputRevisionId) ?? null;
  if (retained === null || binding.exactInputHash !== hashCanonical(retained) ||
      binding.semanticInputIdentity !== retained.semanticInputIdentity ||
      binding.workFamilyRef !== `mechanism-prototype-exploration:${retained.lensId}`) {
    throw new Error("mechanism exploration campaign exact input binding cannot be resolved");
  }
  return retained;
}

export function buildMechanismPrototypeExplorationCampaignPreview(input: Readonly<{
  lenses: readonly MechanismPrototypeExplorationLens[];
  execution: AgentExecutionSnapshot;
  capability: ExecutionCapabilityProjection;
}>): MechanismPrototypeExplorationCampaignPreview {
  const workloadRoute = [...input.execution.workloadRoutes]
    .filter((item) => item.taskKind === "MECHANISM_PROTOTYPE_EXPLORATION")
    .sort((left, right) => right.revision - left.revision)[0];
  if (workloadRoute === undefined) throw new Error("mechanism exploration route is unavailable");
  const executionProfile = input.execution.executionProfiles.find((item) =>
    item.executionProfileId === workloadRoute.executionProfileId
  );
  if (executionProfile === undefined || executionProfile.toolPolicy.protocol !==
      "MECHANISM_PROTOTYPE_EXPLORATION_TOOLS_V15") {
    throw new Error("mechanism exploration execution profile is unavailable");
  }
  const eligible = [...input.lenses]
    // A run attempt is operational history, not semantic coverage. The lens
    // compiler derives campaignEligible from durable trailheads/exhaustions and
    // relevant coverage novelty. This intentionally leaves interrupted or
    // protocol-rejected work eligible for an explicitly revised campaign.
    .filter((lens) => lens.campaignEligible)
    .sort((left, right) =>
      Number(right.currentInputRevision.seedTrailheads.length > 0) -
        Number(left.currentInputRevision.seedTrailheads.length > 0) ||
      (left.axis === "SURFACE_DOMAIN" ? -1 : right.axis === "SURFACE_DOMAIN" ? 1 : 0) ||
      left.lensId.localeCompare(right.lensId)
    )
    .slice(0, 1);
  const selectionBinding = buildMechanismPrototypeExplorationCampaignSelectionBinding(eligible);
  const creationEligible = eligible.length > 0;
  const body = Object.freeze({
    schemaVersion: "pmh.mechanism-prototype-exploration-campaign-preview.v1" as const,
    campaignKey: `mechanism-prototype-exploration-${selectionBinding.selectionIdentity.slice(7)}`,
    workloadRoute,
    executionProfile,
    capability: input.capability,
    selectionBinding,
    taskIds: Object.freeze(eligible.map((item) => item.task.taskId)),
    lensIds: Object.freeze(eligible.map((item) => item.lensId)),
    axes: Object.freeze(eligible.map((item) => item.axis)),
    schedule: Object.freeze({ kind: "MANUAL_ONLY" as const, intervalMs: null }),
    // The campaign key is content-addressed by the semantic-input selection.
    // Therefore the substrate's lineage boundary is exactly this semantic input.
    taskRunPolicy: "ONCE_PER_TASK_PER_LINEAGE" as const,
    budget: Object.freeze({
      maximumConcurrentRuns: 1 as const,
      maximumModelInvocations: 16 as const,
      maximumInputTokens: "500000" as const,
      maximumOutputTokens: "20000" as const,
      maximumWallClockMs: 600000 as const,
    }),
    creationEligible,
    dispatchEligible: false as const,
    diagnostic: eligible.length === 0
      ? "No unexplored mechanism-prototype semantic input is eligible"
      : input.capability.dispatchEligibility !== "ELIGIBLE"
      ? input.capability.diagnostic
      : "One exact lens is ready for paused manual campaign creation",
    providerRequestsStarted: 0 as const,
    modelInvocationsStarted: 0 as const,
    automaticDispatch: false as const,
    semanticDecisionAuthority: false as const,
    authority: "CAMPAIGN_PROPOSAL_ONLY" as const,
  });
  return Object.freeze({ ...body, previewIdentity: hashCanonical(body) });
}
