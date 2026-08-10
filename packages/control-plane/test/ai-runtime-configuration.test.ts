import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AiRuntimeConfigurationConflictError,
  AiRuntimeConfigurationDesk,
  CodexAuthCacheCredentialProvider,
  migrateAiRuntimeConfiguration,
  SqliteOperationalStore,
} from "../src/index.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.test-signature`;
}

describe("AI runtime configuration", () => {
  it("persists provider, model, and effort without retaining credentials", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pmh-ai-runtime-"));
    tempDirectories.push(directory);
    const databasePath = join(directory, "control-plane.sqlite");
    const store = new SqliteOperationalStore(databasePath);
    try {
      const desk = new AiRuntimeConfigurationDesk(
        { PMH_DISCOVERY_PROVIDER: "deepseek" },
        store,
        () => Date.parse("2026-08-09T01:00:00.000Z"),
      );
      expect(desk.current()).toMatchObject({
        revision: 1,
        provider: "DEEPSEEK",
        codexModel: "gpt-5.6-terra",
        codexReasoningEffort: "high",
        deepseekAutomationEnabled: false,
      });

      const updated = desk.update({
        expectedRevision: 1,
        provider: "CODEX",
        codexModel: "gpt-5.6-terra",
        codexReasoningEffort: "xhigh",
        deepseekAutomationEnabled: false,
      });
      expect(updated).toMatchObject({ revision: 2, provider: "CODEX" });
      expect(() => desk.update({
        expectedRevision: 1,
        provider: "DEEPSEEK",
        codexModel: "gpt-5.6-luna",
        codexReasoningEffort: "low",
        deepseekAutomationEnabled: true,
      })).toThrow(AiRuntimeConfigurationConflictError);
      expect(JSON.stringify(desk.projection())).not.toMatch(/access.?token|api.?key/i);
      expect(desk.projection()).toMatchObject({
        storage: { mode: "SQLITE_WAL", durable: true, schemaVersion: 35 },
        credentialTextRetained: false,
        executionAuthority: false,
      });
    } finally {
      store.close();
    }

    const reopened = new SqliteOperationalStore(databasePath);
    try {
      expect(new AiRuntimeConfigurationDesk({}, reopened).current()).toMatchObject({
        revision: 2,
        provider: "CODEX",
        codexModel: "gpt-5.6-terra",
        codexReasoningEffort: "xhigh",
        deepseekAutomationEnabled: false,
      });
    } finally {
      reopened.close();
    }
  });

  it("migrates retained v1 choices with automatic DeepSeek spend disabled", () => {
    expect(migrateAiRuntimeConfiguration({
      schemaVersion: "pmh.ai-runtime-configuration.v1",
      revision: 7,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      updatedAt: "2026-08-09T01:00:00.000Z",
    })).toEqual({
      schemaVersion: "pmh.ai-runtime-configuration.v2",
      revision: 7,
      provider: "CODEX",
      codexModel: "gpt-5.6-terra",
      codexReasoningEffort: "high",
      deepseekAutomationEnabled: false,
      updatedAt: "2026-08-09T01:00:00.000Z",
    });
  });

  it("reads a valid Codex OAuth cache on demand and rejects near-expiry tokens", async () => {
    const now = Date.parse("2026-08-09T01:00:00.000Z");
    const accountId = "account-test-only";
    const token = jwt({
      exp: Math.floor(now / 1_000) + 3_600,
      "https://api.openai.com/auth": { chatgpt_account_id: accountId },
    });
    const cache = JSON.stringify({
      auth_mode: "chatgpt",
      tokens: {
        access_token: token,
        account_id: accountId,
        id_token: "test-only-id-token",
        refresh_token: "test-only-refresh-token",
      },
    });
    const provider = new CodexAuthCacheCredentialProvider(
      { PMH_CODEX_AUTH_FILE: "/test-only/auth.json" },
      () => now,
      () => cache,
    );
    expect(provider.configured()).toBe(true);
    await expect(provider.resolve()).resolves.toMatchObject({
      accessToken: token,
      accountId,
      expiresAt: "2026-08-09T02:00:00.000Z",
      idToken: "test-only-id-token",
      refreshToken: "test-only-refresh-token",
    });

    const expired = new CodexAuthCacheCredentialProvider(
      { PMH_CODEX_AUTH_FILE: "/test-only/auth.json" },
      () => now + 3_550_000,
      () => cache,
    );
    expect(expired.configured()).toBe(false);
    await expect(expired.resolve()).rejects.toThrow(/expired or near expiry/);
  });
});
