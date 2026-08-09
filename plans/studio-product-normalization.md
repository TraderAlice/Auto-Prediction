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
