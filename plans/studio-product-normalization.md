# Studio product normalization

Status: implemented and visually qualified

## Evidence

The live Overview is visually dominated by a wide navigation rail, uppercase
monospace labels, glow effects, raw protocol strings, and a grid whose automatic
placement separates related AI controls from their status. The result reads as
a qualification console rather than an operator product, despite the underlying
workflow already having clear research, review, evidence, and verification
stages.

## Product decision

Keep the existing dark mode and functionality, but normalize the Studio around
ordinary application conventions:

- compact navigation containing only working destinations;
- a page-aware top bar and restrained system posture indicators;
- normal sentence-case typography with monospace reserved for identities and
  exact values;
- independent metric cards and readable surface contrast instead of joined
  instrument panels and glow;
- an Overview AI section grouped into configuration, runtime health, catalog
  state, and explicit actions;
- the same information hierarchy at desktop and narrow widths.

This is a presentation and product-comprehension change. It must not modify
Agent authority, scheduling, persistence, evidence, or execution behavior.

## Qualification

- Existing control-plane and Studio type checks pass.
- The production Studio build passes.
- Live desktop and 390 px views have no horizontal overflow or console errors.
- Provider selection, model/effort controls, scout, catalog refresh, navigation,
  and opportunity inspection remain discoverable and operable.

The live retained projection qualified the new shell with 799 listings and all
seven sources healthy. Desktop inspection covered Overview and Market
Archaeologist; a temporary 390×844 viewport measured equal 375 px body and
document widths, including the open mobile navigation. No browser console
warnings or errors were emitted. All workspace type checks, ten Studio tests,
and the production Studio build pass on the current worktree.
