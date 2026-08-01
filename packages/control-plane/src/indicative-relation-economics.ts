import {
  divideCeil,
  divideFloor,
  hashCanonical,
  parseFixed,
} from "@pmh/domain";
import type {
  DurableProposalEvidenceBundle,
  MarketRelationProposal,
} from "./market-archaeologist.js";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  relationPortfolioOutcomes,
  type CompilableRelation,
} from "./relation-payoff.js";
import type { DiscoveryCatalogListing } from "./types.js";

export type CanonicalIndicativeEconomics = Readonly<{
  status:
    | "POSITIVE_GROSS_HINT"
    | "NON_POSITIVE_GROSS_HINT"
    | "PRICE_UNAVAILABLE";
  portfolioLabel: string | null;
  indicativeCostBpsCeil: string | null;
  grossEdgeBpsFloor: string | null;
  source: "CURRENT_CONTRACT_MATCHED" | null;
  feesIncluded: false;
  depthIncluded: false;
  executable: false;
}>;

export function contractSemanticIdentity(
  listing: DiscoveryCatalogListing,
): unknown {
  return {
    listingRef: listing.listingRef,
    venueId: listing.venueId,
    venueInstrumentId: listing.venueInstrumentId,
    title: listing.title,
    description: listing.description,
    mechanism: listing.mechanism,
    closesAt: listing.closesAt,
    rulesText: listing.rulesText,
    outcomes: listing.outcomes.map(({ venueOutcomeId, label }) => ({
      venueOutcomeId,
      label,
    })),
    priceScale: listing.priceScale,
    quantityScale: listing.quantityScale,
    minPriceTick: listing.minPriceTick,
    protocolIdentity: listing.protocolIdentity,
  };
}

export function matchedCurrentContractListings(
  proposal: MarketRelationProposal,
  bundle: DurableProposalEvidenceBundle | null,
  corpus: MarketCorpusSnapshot,
): ReadonlyMap<string, DiscoveryCatalogListing> {
  if (bundle === null) return new Map();
  const captured = new Map(
    bundle.listings.map((listing) => [listing.listingRef, listing] as const),
  );
  const current = new Map(
    corpus.listings.map((listing) => [listing.listingRef, listing] as const),
  );
  return new Map(
    proposal.listingRefs.flatMap((listingRef) => {
      const capturedListing = captured.get(listingRef);
      const currentListing = current.get(listingRef);
      return capturedListing !== undefined &&
        currentListing !== undefined &&
        hashCanonical(contractSemanticIdentity(capturedListing)) ===
          hashCanonical(contractSemanticIdentity(currentListing))
        ? [[listingRef, currentListing] as const]
        : [];
    }),
  );
}

function outcomePrice(
  listing: DiscoveryCatalogListing,
  side: "TRUE" | "FALSE",
): Readonly<{ price: bigint; scale: bigint }> | null {
  const wanted = side === "TRUE" ? ["yes", "up"] : ["no", "down"];
  const outcome = listing.outcomes.find((item) =>
    wanted.includes(item.label.trim().toLowerCase()),
  );
  if (
    outcome?.indicativePrice === null ||
    outcome?.indicativePrice === undefined
  ) return null;
  try {
    const scale = BigInt(listing.priceScale);
    const price = parseFixed(outcome.indicativePrice, scale);
    return scale > 0n && price >= 0n && price <= scale
      ? Object.freeze({ price, scale })
      : null;
  } catch {
    return null;
  }
}

export function calculateCanonicalIndicativeEconomics(input: {
  proposal: MarketRelationProposal;
  relation: CompilableRelation;
  currentListings: ReadonlyMap<string, DiscoveryCatalogListing>;
}): CanonicalIndicativeEconomics {
  return calculateTwoListingIndicativeEconomics({
    listingRefs: input.proposal.listingRefs,
    relation: input.relation,
    currentListings: input.currentListings,
  });
}

export function calculateTwoListingIndicativeEconomics(input: {
  listingRefs: readonly string[];
  relation: CompilableRelation;
  currentListings: ReadonlyMap<string, DiscoveryCatalogListing>;
}): CanonicalIndicativeEconomics {
  const inert = Object.freeze({
    portfolioLabel: null,
    indicativeCostBpsCeil: null,
    grossEdgeBpsFloor: null,
    source: null,
    feesIncluded: false as const,
    depthIncluded: false as const,
    executable: false as const,
  });
  if (
    input.listingRefs.length !== 2 ||
    new Set(input.listingRefs).size !== 2
  ) {
    return Object.freeze({ status: "PRICE_UNAVAILABLE" as const, ...inert });
  }
  const [leftRef, rightRef] = input.listingRefs;
  const left = leftRef === undefined
    ? undefined
    : input.currentListings.get(leftRef);
  const right = rightRef === undefined
    ? undefined
    : input.currentListings.get(rightRef);
  if (left === undefined || right === undefined) {
    return Object.freeze({ status: "PRICE_UNAVAILABLE" as const, ...inert });
  }
  const candidates = relationPortfolioOutcomes(input.relation).flatMap(
    (portfolio) => {
      const leftPrice = outcomePrice(left, portfolio.left);
      const rightPrice = outcomePrice(right, portfolio.right);
      if (leftPrice === null || rightPrice === null) return [];
      const denominator = leftPrice.scale * rightPrice.scale;
      const costNumerator =
        leftPrice.price * rightPrice.scale +
        rightPrice.price * leftPrice.scale;
      return [{
        portfolio,
        denominator,
        costNumerator,
        edgeNumerator: denominator - costNumerator,
      }];
    },
  );
  if (candidates.length === 0) {
    return Object.freeze({ status: "PRICE_UNAVAILABLE" as const, ...inert });
  }
  candidates.sort((leftCandidate, rightCandidate) => {
    const leftCross = leftCandidate.edgeNumerator * rightCandidate.denominator;
    const rightCross = rightCandidate.edgeNumerator * leftCandidate.denominator;
    return leftCross === rightCross
      ? leftCandidate.portfolio.label.localeCompare(rightCandidate.portfolio.label)
      : leftCross > rightCross ? -1 : 1;
  });
  const best = candidates[0]!;
  return Object.freeze({
    status: best.edgeNumerator > 0n
      ? "POSITIVE_GROSS_HINT" as const
      : "NON_POSITIVE_GROSS_HINT" as const,
    portfolioLabel: best.portfolio.label,
    indicativeCostBpsCeil: divideCeil(
      best.costNumerator * 10_000n,
      best.denominator,
    ).toString(),
    grossEdgeBpsFloor: divideFloor(
      best.edgeNumerator * 10_000n,
      best.denominator,
    ).toString(),
    source: "CURRENT_CONTRACT_MATCHED" as const,
    feesIncluded: false as const,
    depthIncluded: false as const,
    executable: false as const,
  });
}
