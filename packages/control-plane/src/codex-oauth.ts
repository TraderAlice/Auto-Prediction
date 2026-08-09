import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT_CLAIM = "https://api.openai.com/auth";

export type CodexOAuthCredential = Readonly<{
  accessToken: string;
  accountId: string;
  expiresAt: string;
}>;

export interface CodexOAuthCredentialProvider {
  configured(): boolean;
  resolve(): Promise<CodexOAuthCredential>;
}

type CodexAuthCache = Readonly<{
  auth_mode?: unknown;
  tokens?: Readonly<{
    access_token?: unknown;
    account_id?: unknown;
  }>;
}>;

type JwtPayload = Readonly<{
  exp?: unknown;
  [ACCOUNT_CLAIM]?: Readonly<{ chatgpt_account_id?: unknown }>;
}>;

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[1] === undefined) {
    throw new Error("Codex OAuth access token is not a JWT");
  }
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as JwtPayload;
  } catch {
    throw new Error("Codex OAuth access token payload is invalid");
  }
}

function credentialFromCache(value: CodexAuthCache, now: number): CodexOAuthCredential {
  const token = value.tokens?.access_token;
  if (value.auth_mode !== "chatgpt" || typeof token !== "string" || token === "") {
    throw new Error("Codex OAuth cache does not contain a ChatGPT access token");
  }
  const payload = decodeJwtPayload(token);
  if (typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp)) {
    throw new Error("Codex OAuth access token has no bounded expiry");
  }
  const expiresAtMs = payload.exp * 1_000;
  if (expiresAtMs <= now + 60_000) {
    throw new Error("Codex OAuth access token is expired or near expiry; refresh Codex login");
  }
  const cacheAccountId = value.tokens?.account_id;
  const claimAccountId = payload[ACCOUNT_CLAIM]?.chatgpt_account_id;
  const accountId = typeof cacheAccountId === "string" && cacheAccountId !== ""
    ? cacheAccountId
    : claimAccountId;
  if (typeof accountId !== "string" || accountId === "") {
    throw new Error("Codex OAuth access token has no ChatGPT account ID");
  }
  return Object.freeze({
    accessToken: token,
    accountId,
    expiresAt: new Date(expiresAtMs).toISOString(),
  });
}

export class CodexAuthCacheCredentialProvider implements CodexOAuthCredentialProvider {
  readonly #authFile: string;

  public constructor(
    environment: Readonly<Record<string, string | undefined>> = process.env,
    private readonly now: () => number = Date.now,
    private readonly readText: (path: string) => string = (path) =>
      readFileSync(path, "utf8"),
  ) {
    const configuredPath = environment.PMH_CODEX_AUTH_FILE?.trim();
    const codexHome = environment.CODEX_HOME?.trim();
    this.#authFile = configuredPath || join(codexHome || join(homedir(), ".codex"), "auth.json");
  }

  #read(): CodexOAuthCredential {
    let parsed: CodexAuthCache;
    try {
      parsed = JSON.parse(this.readText(this.#authFile)) as CodexAuthCache;
    } catch {
      throw new Error("Codex OAuth cache is unavailable; sign in with Codex first");
    }
    return credentialFromCache(parsed, this.now());
  }

  public configured(): boolean {
    try {
      this.#read();
      return true;
    } catch {
      return false;
    }
  }

  public async resolve(): Promise<CodexOAuthCredential> {
    return this.#read();
  }
}

export function codexCredentialForTest(
  accessToken: string,
  accountId: string,
): CodexOAuthCredentialProvider {
  return Object.freeze({
    configured: () => true,
    resolve: async () => Object.freeze({
      accessToken,
      accountId,
      expiresAt: "2099-01-01T00:00:00.000Z",
    }),
  });
}
