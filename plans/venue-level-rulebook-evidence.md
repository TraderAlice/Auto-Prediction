# Venue-level rulebook evidence

Status: first Polymarket US document route live-qualified

Created: 2026-08-10

## Product problem

A market's own resolution text may still depend on venue-wide review,
fallback, appeal, cancellation, or discretionary policy. Treating the listing
body as the whole settlement protocol can therefore manufacture certainty.
The evidence system already knows how to retain a content-addressed document,
but listings need a first-party locator that reaches the applicable venue-level
rules without giving the Agent open-web fetch authority.

## Decision

- Fresh Polymarket US catalog listings attach the current official CFTC-hosted
  rulebook as a `CONTRACT_RULE_DOCUMENT` locator.
- The catalog normalizer identity changes when this locator becomes part of the
  normalized listing. Historical observations replay under their original
  normalizer and require a fresh capture for the new evidence posture.
- The first-party fetch policy allows only the exact CFTC host, HTTPS, bounded
  bytes, and the official DOCX content type. Redirects, DNS, content encoding,
  and Clash fake-IP posture retain the existing fail-closed checks.
- DOCX extraction produces bounded untrusted text and preserves the raw bytes,
  receive time, headers, source URL, hashes, and protocol identity.
- Venue policy is evidence, not automatic support. A rulebook passage may
  support, contradict, or leave a requirement inconclusive; only quote-verified
  Agent claim effects enter an enriched review scope.

## Qualification

- Adapter and catalog tests bind the locator to every fresh Polymarket US
  listing and keep unrelated venues unchanged.
- A minimal DOCX fixture proves extraction and byte/text bounds.
- Historical catalog observations are verified against their old normalizer
  before being retired for fresh capture; no retained hash is reinterpreted.
- Live anonymous capture of the June 2026 CFTC filing retrieved 4,140,483 bytes
  and extracted 197,796 characters, including the Contract Outcome Review
  Process and venue-discretion language.
- Semantic review remains conservative when that language does not determine a
  listing-specific state. No document capture grants simulation, certificate,
  execution, credential, signing, or value-moving authority.

## Next evidence

Route the current House external requirement through the retained document,
record a quote-verified support/contradiction/inconclusive claim, and measure
whether the enriched review resolves the dependency or confirms that exact
admission is unavailable under the venue's discretionary process.
