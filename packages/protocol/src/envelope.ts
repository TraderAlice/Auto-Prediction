import type { Hash } from "@pmh/domain";

export type EventEnvelope<T> = Readonly<{
  venue: string;
  protocolVersion: string;
  instrumentId?: string;
  venueSequence?: string;
  venueTimestamp?: string;
  receivedAt: string;
  monotonicReceivedNs: bigint;
  processedAt: string;
  clockOffsetNs?: bigint;
  clockUncertaintyNs?: bigint;
  rawHash: Hash;
  payload: T;
}>;

export type RawFixtureIdentity = Readonly<{
  venue: string;
  sourceUrl: string;
  fetchedAt: string;
  httpStatus: number;
  contentType: string;
  protocolVersion: string;
  rawHash: Hash;
  byteLength: bigint;
}>;

export function assertEnvelopeIdentity<T>(
  envelope: EventEnvelope<T>,
  expectedVenue: string,
  expectedProtocolVersion: string,
): void {
  if (envelope.venue !== expectedVenue) {
    throw new Error(
      `event venue ${envelope.venue} does not match adapter ${expectedVenue}`,
    );
  }
  if (envelope.protocolVersion !== expectedProtocolVersion) {
    throw new Error(
      `event protocol ${envelope.protocolVersion} does not match adapter ${expectedProtocolVersion}`,
    );
  }
  if (envelope.monotonicReceivedNs < 0n) {
    throw new Error("monotonic receive time must be non-negative");
  }
}
