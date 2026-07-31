import { geminiManifest } from "@pmh/venue-gemini";
import { kalshiManifest } from "@pmh/venue-kalshi";
import { myriadManifest } from "@pmh/venue-myriad";
import { opinionManifest } from "@pmh/venue-opinion";
import { polymarketManifest } from "@pmh/venue-polymarket";
import { assertManifest, type VenueManifest } from "@pmh/protocol";

const manifests = [
  polymarketManifest,
  kalshiManifest,
  geminiManifest,
  opinionManifest,
  myriadManifest,
].map(assertManifest);

export const venueRegistry: ReadonlyMap<string, VenueManifest> = new Map(
  manifests.map((manifest) => [manifest.venueId, manifest]),
);
