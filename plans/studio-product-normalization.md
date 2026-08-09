# Studio product normalization

Status: implemented; operator re-review pending

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

## Typography and component-system follow-on

The first normalization pass fixed the shell hierarchy but retained the old
console's typography debt: dozens of one-off sizes below 12 px, monospace used
as ordinary prose, and native form controls with unrelated browser styling.
The follow-on establishes a small, reusable shadcn-compatible UI layer:

- Inter is the application face; JetBrains Mono is reserved for identifiers,
  hashes, protocol values, and other exact machine-readable text;
- visible interface text has a 12 px floor and uses a bounded type scale;
- Input, Textarea, Badge, Button, Card, and Radix-backed Select share the same
  semantic tokens, radius, focus ring, disabled state, and dark surfaces;
- Overview, Market Archaeologist, Opportunity Lifecycle, Scout Inbox, and the
  command palette use those primitives without changing their behavior.

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

The typography follow-on was visually requalified on Overview, Market
Archaeologist, and Opportunity Lifecycle at desktop width and on Opportunity
Lifecycle at 390×844. The computed visible-text audit reports Inter as the body
face, a 12 px minimum, and no document overflow. The Radix Select portal opens,
exposes accessible combobox/option roles, and closes without changing the saved
runtime selection.

## 2026-08-09 operator-shell follow-on

The component layer alone did not solve the product hierarchy. The Studio still
opened on an architecture overview, exposed ten internal subsystem names as if
they were equally important tasks, and placed the discovery action below model
configuration. A separate product-shell layer now owns the application tokens
and hierarchy without rewriting protocol-specific layouts:

- task navigation starts with Discover, Findings, Review, Preflight, Markets,
  and Evidence; diagnostic projections remain grouped under System;
- Discover is the default route and exposes “Explore next neighborhood” above
  the fold;
- the primary action issues a heuristic search lease instead of submitting a
  fixed demonstration claim;
- Inter owns all human interface copy, JetBrains Mono is limited to machine
  values, and the visible main-content floor is 12 px;
- graphite surfaces, restrained borders, consistent radii, and shadcn buttons,
  cards, badges, inputs, textarea, and Radix Select replace the instrument-panel
  glow and arbitrary type treatments.

The retained 799-market projection was inspected at 1280×720 and 390×844. Both
widths have equal body/document width, the primary action remains visible, the
mobile drawer opens at 264 px, and the computed main-content font range starts
at 12 px.

## 2026-08-10 operator evidence and second normalization

The operator's direct visual review is stronger evidence than the previous
mechanical typography and overflow checks. Although the component primitives
were present, the result still read as a dense protocol console: too many
simultaneous navigation destinations, uppercase status copy, machine-facing
labels, weak card hierarchy, and an Overview whose controls competed with its
primary task. The earlier “visually qualified” status was therefore premature.

The second pass treats the shadcn-compatible primitives and tokens as the
actual visual system rather than an implementation detail. It narrows the
content measure, removes decorative instrument-panel styling, reduces the top
bar to page context/search/sync, uses one restrained Inter scale, and makes the
heuristic discovery action the visual start of the product. Claim-first work is
renamed and demoted to a focused-watch lane: useful for validating an existing
hypothesis, never presented as the default source of new opportunities.

Qualification requires a fresh live desktop and narrow-width visual inspection;
the old screenshots and computed font-floor audit are not sufficient evidence.

The second pass was exercised against the retained 799-market live projection
in a clean Vite session. At 1280×720, the default Discover document fell from
14,502 px to 2,347 px after operations and Agent internals were moved into two
closed, keyboard/click-operable disclosure regions. At 390×844, the document
width was 375 px inside the 390 px viewport, navigation became a drawer trigger,
the primary exploration action remained above the fold, and both disclosure
regions opened and closed without losing their contents. The live browser log
contained no warnings or errors. All 578 workspace tests, all workspace type
checks, the Studio production build, and `git diff --check` pass. A legacy live
projection missing `findingSummaries` also no longer crashes the Discover view.
