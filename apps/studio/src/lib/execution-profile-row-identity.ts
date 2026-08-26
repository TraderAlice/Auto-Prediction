const HASH_PREFIX = "sha256:";
const SHORT_ID_LENGTH = 10;

export type ExecutionProfileRowIdentityInput = Readonly<{
  executionProfileId: string;
  profileKey: string;
  revision: number;
}>;

function shortExecutionProfileId(executionProfileId: string): string {
  return executionProfileId.startsWith(HASH_PREFIX)
    ? executionProfileId.slice(HASH_PREFIX.length, HASH_PREFIX.length + SHORT_ID_LENGTH)
    : executionProfileId.slice(0, SHORT_ID_LENGTH);
}

export function executionProfileRowIdentity(
  profile: ExecutionProfileRowIdentityInput,
): string {
  return `r${profile.revision} · ${profile.profileKey} · ${shortExecutionProfileId(profile.executionProfileId)}`;
}
