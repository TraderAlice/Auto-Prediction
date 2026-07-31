import { readFile } from "node:fs/promises";
import { hashBytes, type Hash } from "@pmh/domain";
import { z } from "zod";

export const RawFixtureMetadataSchema = z.object({
  schemaVersion: z.literal("pmh.raw-fixture.v1"),
  name: z.string().min(1),
  venue: z.string().min(1),
  protocolVersion: z.string().min(1),
  sourceUrl: z.url(),
  fetchedAt: z.iso.datetime({ offset: true }),
  httpStatus: z.number().int().min(100).max(599),
  contentType: z.string().min(1),
  etag: z.string().nullable(),
  lastModified: z.string().nullable(),
  rawHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  byteLength: z.string().regex(/^(?:0|[1-9]\d*)$/),
  acquisition: z.object({
    method: z.literal("GET"),
    credentialsUsed: z.literal(false),
    valueMovingOperation: z.literal(false),
  }),
});

export type RawFixtureMetadata = z.infer<typeof RawFixtureMetadataSchema>;

export type VerifiedRawFixture = Readonly<{
  metadata: RawFixtureMetadata;
  bytes: Uint8Array;
  rawHash: Hash;
}>;

export function verifyRawFixture(
  bytes: Uint8Array,
  metadataInput: unknown,
): VerifiedRawFixture {
  const metadata = RawFixtureMetadataSchema.parse(metadataInput);
  const rawHash = hashBytes(bytes);
  if (rawHash !== metadata.rawHash) {
    throw new Error(
      `fixture hash mismatch: expected ${metadata.rawHash}, received ${rawHash}`,
    );
  }
  if (BigInt(bytes.byteLength) !== BigInt(metadata.byteLength)) {
    throw new Error(
      `fixture byte length mismatch: expected ${metadata.byteLength}, received ${bytes.byteLength}`,
    );
  }
  return { metadata, bytes, rawHash };
}

export async function loadRawFixture(
  payloadPath: string,
  metadataPath: string,
): Promise<VerifiedRawFixture> {
  const [bytes, metadataBytes] = await Promise.all([
    readFile(payloadPath),
    readFile(metadataPath),
  ]);
  const metadata: unknown = JSON.parse(metadataBytes.toString("utf8"));
  return verifyRawFixture(bytes, metadata);
}
