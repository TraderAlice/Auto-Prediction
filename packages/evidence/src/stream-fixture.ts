import { readFile } from "node:fs/promises";
import {
  hashBytes,
  hashCanonical,
  type Hash,
} from "@pmh/domain";
import { z } from "zod";

const HashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const StreamFrameSchema = z.object({
  ordinal: z.string().regex(/^(?:0|[1-9]\d*)$/),
  receivedAt: z.iso.datetime({ offset: true }),
  eventName: z.string().min(1).nullable(),
  rawText: z.string(),
  frameHash: HashSchema,
});

export const StreamAcquisitionSchema = z.object({
  schemaVersion: z.literal("pmh.stream-acquisition.v1"),
  frames: z.array(StreamFrameSchema),
});

export const StreamFixtureMetadataSchema = z.object({
  schemaVersion: z.literal("pmh.stream-fixture.v1"),
  name: z.string().min(1),
  venue: z.string().min(1),
  protocolVersion: z.string().min(1),
  sourceUrl: z.url(),
  connectedAt: z.iso.datetime({ offset: true }),
  closedAt: z.iso.datetime({ offset: true }),
  transport: z.enum(["WEBSOCKET", "SOCKET_IO_WEBSOCKET"]),
  subscription: z.unknown(),
  subscriptionHash: HashSchema,
  instrumentIds: z.array(z.string().min(1)).min(1).readonly(),
  frameCount: z.string().regex(/^(?:0|[1-9]\d*)$/),
  rawHash: HashSchema,
  byteLength: z.string().regex(/^(?:0|[1-9]\d*)$/),
  acquisition: z.object({
    credentialsUsed: z.literal(false),
    valueMovingOperation: z.literal(false),
  }),
});

export type StreamFrame = Omit<
  z.infer<typeof StreamFrameSchema>,
  "frameHash"
> & { frameHash: Hash };
export type StreamFixtureMetadata = z.infer<
  typeof StreamFixtureMetadataSchema
>;

export type VerifiedStreamFixture = Readonly<{
  metadata: StreamFixtureMetadata;
  bytes: Uint8Array;
  frames: readonly StreamFrame[];
  rawHash: Hash;
}>;

export function verifyStreamFixture(
  bytes: Uint8Array,
  metadataInput: unknown,
): VerifiedStreamFixture {
  const metadata = StreamFixtureMetadataSchema.parse(metadataInput);
  const rawHash = hashBytes(bytes);
  if (rawHash !== metadata.rawHash) {
    throw new Error(
      `stream fixture hash mismatch: expected ${metadata.rawHash}, received ${rawHash}`,
    );
  }
  if (BigInt(bytes.byteLength) !== BigInt(metadata.byteLength)) {
    throw new Error(
      `stream fixture byte length mismatch: expected ${metadata.byteLength}, received ${bytes.byteLength}`,
    );
  }
  if (hashCanonical(metadata.subscription) !== metadata.subscriptionHash) {
    throw new Error("stream fixture subscription hash mismatch");
  }

  const acquisition = StreamAcquisitionSchema.parse(
    JSON.parse(new TextDecoder().decode(bytes)),
  );
  if (BigInt(acquisition.frames.length) !== BigInt(metadata.frameCount)) {
    throw new Error("stream fixture frame count mismatch");
  }
  acquisition.frames.forEach((frame, index) => {
    if (BigInt(frame.ordinal) !== BigInt(index)) {
      throw new Error(`stream fixture frame ${index} has a non-contiguous ordinal`);
    }
    const frameHash = hashBytes(new TextEncoder().encode(frame.rawText));
    if (frameHash !== frame.frameHash) {
      throw new Error(`stream fixture frame ${index} hash mismatch`);
    }
  });
  const frames: readonly StreamFrame[] = acquisition.frames.map((frame) => ({
    ...frame,
    frameHash: frame.frameHash as Hash,
  }));
  return {
    metadata,
    bytes,
    frames,
    rawHash,
  };
}

export async function loadStreamFixture(
  payloadPath: string,
  metadataPath: string,
): Promise<VerifiedStreamFixture> {
  const [bytes, metadataBytes] = await Promise.all([
    readFile(payloadPath),
    readFile(metadataPath),
  ]);
  const metadata: unknown = JSON.parse(metadataBytes.toString("utf8"));
  return verifyStreamFixture(bytes, metadata);
}
