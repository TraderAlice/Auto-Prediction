import { hashCanonical, type Hash } from "@pmh/domain";
import type { MarketCorpusSnapshot } from "./market-corpus.js";
import {
  marketOntologyPredicateFamiliesForText,
  type MarketOntologyPredicateFamily,
} from "./market-ontology.js";
import {
  mechanismPrototypeExplorationAggregateCue,
  mechanismPrototypeExplorationComponentCue,
} from "./mechanism-prototype-guided-exploration.js";

const MAX_EXEMPLARS_PER_NEIGHBORHOOD = 3;
const MAX_EXEMPLARS_PER_TITLE_FORM = 2;
const MAX_EXEMPLARS_PER_ROLE = 4;
const MAX_EXEMPLARS_PER_VENUE = 1;
const MAX_TITLE_CHARACTERS = 180;

export const CORPUS_DIALECT_TITLE_FORMS = Object.freeze([
  "INTERROGATIVE",
  "VERSUS",
  "CANDIDATE_SUFFIX",
  "UP_OR_DOWN",
  "THRESHOLD",
  "OUTCOME_BUNDLE",
  "OTHER",
] as const);

export type CorpusDialectTitleForm =
  (typeof CORPUS_DIALECT_TITLE_FORMS)[number];

export type CorpusDialectExemplar = Readonly<{
  listingRef: string;
  venueId: string;
  title: string;
}>;

type CorpusDialectAnnotatedExemplar = CorpusDialectExemplar & Readonly<{
  predicateFamilies: readonly MarketOntologyPredicateFamily[];
  titleForms: readonly CorpusDialectTitleForm[];
  componentRoleCue: boolean;
  aggregateRoleCue: boolean;
}>;

export type CorpusDialectAtlas = Readonly<{
  schemaVersion: "pmh.corpus-dialect-atlas.v1";
  algorithmVersion: "pmh.corpus-dialect-atlas.lexical.v1";
  atlasIdentity: Hash;
  sourceSnapshotIdentity: Hash;
  listingCount: number;
  venueCount: number;
  predicateFamilyCount: number;
  titleFormCount: number;
  componentRoleCueCount: number;
  aggregateRoleCueCount: number;
  venueDialects: readonly Readonly<{
    venueId: string;
    listingCount: number;
    predicateFamilyCounts: readonly Readonly<{
      predicateFamily: MarketOntologyPredicateFamily;
      listingCount: number;
    }>[];
    titleFormCounts: readonly Readonly<{
      titleForm: CorpusDialectTitleForm;
      listingCount: number;
    }>[];
    componentRoleCueCount: number;
    aggregateRoleCueCount: number;
    exemplars: readonly CorpusDialectExemplar[];
  }>[];
  predicateNeighborhoods: readonly Readonly<{
    predicateFamily: MarketOntologyPredicateFamily;
    listingCount: number;
    venueCount: number;
    componentRoleCueCount: number;
    aggregateRoleCueCount: number;
    exemplars: readonly CorpusDialectExemplar[];
  }>[];
  titleFormNeighborhoods: readonly Readonly<{
    titleForm: CorpusDialectTitleForm;
    listingCount: number;
    venueCount: number;
    exemplars: readonly CorpusDialectExemplar[];
  }>[];
  roleNeighborhoods: Readonly<{
    predicateFamilyCounts: readonly Readonly<{
      predicateFamily: MarketOntologyPredicateFamily;
      componentRoleCueCount: number;
      aggregateRoleCueCount: number;
    }>[];
    component: Readonly<{
      listingCount: number;
      venueCount: number;
      exemplars: readonly CorpusDialectExemplar[];
    }>;
    aggregate: Readonly<{
      listingCount: number;
      venueCount: number;
      exemplars: readonly CorpusDialectExemplar[];
    }>;
  }>;
  ontologicalPosture:
    "VENUE_TITLE_IS_CONTRACT_SURFACE_LANGUAGE_NOT_CERTIFIED_WORLD_SEMANTICS";
  samplingPosture: "VENUE_DIVERSE_BOUNDED_EXACT_TITLE_EXEMPLARS";
  authority: "LEXICAL_QUERY_RECONNAISSANCE_ONLY";
  subjectIdentityAuthority: false;
  semanticDecisionAuthority: false;
  probabilityAuthority: false;
  schedulingAuthority: false;
  certificateAuthority: false;
  executionAuthority: false;
  effects: Readonly<{
    providerRequests: false;
    externalWrites: false;
    valueMovingActions: false;
    liveExecutionEnabled: false;
  }>;
}>;

export function corpusDialectTitleForms(title: string): readonly CorpusDialectTitleForm[] {
  const normalized = title.normalize("NFKC").trim();
  const forms: CorpusDialectTitleForm[] = [];
  if (/^(?:will|who|which|when|what|how)\b|\?$/iu.test(normalized)) {
    forms.push("INTERROGATIVE");
  }
  if (/\bvs\.?\b/iu.test(normalized)) forms.push("VERSUS");
  if (/\s[—–]\s/u.test(normalized)) forms.push("CANDIDATE_SUFFIX");
  if (/\bup\s+or\s+down\b/iu.test(normalized)) forms.push("UP_OR_DOWN");
  if (/\b(?:above|below|over|under|at least|at most)\b|[$€£]\s?\d/iu.test(normalized)) {
    forms.push("THRESHOLD");
  }
  if (/^(?:yes|no)\s+[^,]+,(?:yes|no)\s+/iu.test(normalized)) {
    forms.push("OUTCOME_BUNDLE");
  }
  return Object.freeze(forms.length === 0 ? ["OTHER"] : forms.sort());
}

function exemplar(input: MarketCorpusSnapshot["listings"][number]): CorpusDialectAnnotatedExemplar {
  return Object.freeze({
    listingRef: input.listingRef,
    venueId: input.venueId,
    title: input.title.slice(0, MAX_TITLE_CHARACTERS),
    predicateFamilies: marketOntologyPredicateFamiliesForText(input.title),
    titleForms: corpusDialectTitleForms(input.title),
    componentRoleCue: mechanismPrototypeExplorationComponentCue(input.title),
    aggregateRoleCue: mechanismPrototypeExplorationAggregateCue(input.title),
  });
}

function diverseExemplars(
  values: readonly CorpusDialectAnnotatedExemplar[],
  maximum: number,
): readonly CorpusDialectExemplar[] {
  const byVenue = new Map<string, CorpusDialectAnnotatedExemplar[]>();
  for (const value of [...values].sort((left, right) =>
    left.venueId.localeCompare(right.venueId) || left.listingRef.localeCompare(right.listingRef)
  )) {
    const items = byVenue.get(value.venueId) ?? [];
    items.push(value);
    byVenue.set(value.venueId, items);
  }
  const selected: CorpusDialectAnnotatedExemplar[] = [];
  for (let offset = 0; selected.length < Math.min(values.length, maximum); offset += 1) {
    let added = false;
    for (const venueId of [...byVenue.keys()].sort()) {
      const value = byVenue.get(venueId)?.[offset];
      if (value === undefined) continue;
      selected.push(value);
      added = true;
      if (selected.length >= maximum) break;
    }
    if (!added) break;
  }
  return Object.freeze(selected.map(({ listingRef, venueId, title }) =>
    Object.freeze({ listingRef, venueId, title })
  ));
}

function countBy<T extends string>(values: readonly T[]): ReadonlyMap<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

export function buildCorpusDialectAtlas(corpus: MarketCorpusSnapshot): CorpusDialectAtlas {
  const exemplars = Object.freeze(corpus.listings.map(exemplar));
  const venueIds = Object.freeze([...new Set(exemplars.map((item) => item.venueId))].sort());
  const predicateFamilies = Object.freeze([...new Set(exemplars.flatMap((item) =>
    item.predicateFamilies
  ))].sort()) as readonly MarketOntologyPredicateFamily[];
  const observedTitleForms = Object.freeze(CORPUS_DIALECT_TITLE_FORMS.filter((form) =>
    exemplars.some((item) => item.titleForms.includes(form))
  ));
  const venueDialects = Object.freeze(venueIds.map((venueId) => {
    const members = exemplars.filter((item) => item.venueId === venueId);
    const predicateCounts = countBy(members.flatMap((item) => item.predicateFamilies));
    const titleFormCounts = countBy(members.flatMap((item) => item.titleForms));
    return Object.freeze({
      venueId,
      listingCount: members.length,
      predicateFamilyCounts: Object.freeze([...predicateCounts.entries()]
        .map(([predicateFamily, listingCount]) => Object.freeze({ predicateFamily, listingCount }))
        .sort((left, right) => right.listingCount - left.listingCount ||
          left.predicateFamily.localeCompare(right.predicateFamily))),
      titleFormCounts: Object.freeze([...titleFormCounts.entries()]
        .map(([titleForm, listingCount]) => Object.freeze({ titleForm, listingCount }))
        .sort((left, right) => right.listingCount - left.listingCount ||
          left.titleForm.localeCompare(right.titleForm))),
      componentRoleCueCount: members.filter((item) => item.componentRoleCue).length,
      aggregateRoleCueCount: members.filter((item) => item.aggregateRoleCue).length,
      exemplars: diverseExemplars(members, MAX_EXEMPLARS_PER_VENUE),
    });
  }));
  const predicateNeighborhoods = Object.freeze(predicateFamilies.map((predicateFamily) => {
    const members = exemplars.filter((item) => item.predicateFamilies.includes(predicateFamily));
    return Object.freeze({
      predicateFamily,
      listingCount: members.length,
      venueCount: new Set(members.map((item) => item.venueId)).size,
      componentRoleCueCount: members.filter((item) => item.componentRoleCue).length,
      aggregateRoleCueCount: members.filter((item) => item.aggregateRoleCue).length,
      exemplars: diverseExemplars(members, MAX_EXEMPLARS_PER_TITLE_FORM),
    });
  }).sort((left, right) => right.listingCount - left.listingCount ||
    left.predicateFamily.localeCompare(right.predicateFamily)));
  const titleFormNeighborhoods = Object.freeze(observedTitleForms.map((titleForm) => {
    const members = exemplars.filter((item) => item.titleForms.includes(titleForm));
    return Object.freeze({
      titleForm,
      listingCount: members.length,
      venueCount: new Set(members.map((item) => item.venueId)).size,
      exemplars: diverseExemplars(members, MAX_EXEMPLARS_PER_NEIGHBORHOOD),
    });
  }).sort((left, right) => right.listingCount - left.listingCount ||
    left.titleForm.localeCompare(right.titleForm)));
  const componentRoleMembers = exemplars.filter((item) => item.componentRoleCue);
  const aggregateRoleMembers = exemplars.filter((item) => item.aggregateRoleCue);
  const roleNeighborhoods = Object.freeze({
    predicateFamilyCounts: Object.freeze(predicateFamilies.map((predicateFamily) => {
      const members = exemplars.filter((item) => item.predicateFamilies.includes(predicateFamily));
      return Object.freeze({
        predicateFamily,
        componentRoleCueCount: members.filter((item) => item.componentRoleCue).length,
        aggregateRoleCueCount: members.filter((item) => item.aggregateRoleCue).length,
      });
    }).sort((left, right) =>
      right.componentRoleCueCount + right.aggregateRoleCueCount -
        (left.componentRoleCueCount + left.aggregateRoleCueCount) ||
      left.predicateFamily.localeCompare(right.predicateFamily))),
    component: Object.freeze({
      listingCount: componentRoleMembers.length,
      venueCount: new Set(componentRoleMembers.map((item) => item.venueId)).size,
      exemplars: diverseExemplars(componentRoleMembers, MAX_EXEMPLARS_PER_ROLE),
    }),
    aggregate: Object.freeze({
      listingCount: aggregateRoleMembers.length,
      venueCount: new Set(aggregateRoleMembers.map((item) => item.venueId)).size,
      exemplars: diverseExemplars(aggregateRoleMembers, MAX_EXEMPLARS_PER_ROLE),
    }),
  });
  const body = Object.freeze({
    schemaVersion: "pmh.corpus-dialect-atlas.v1" as const,
    algorithmVersion: "pmh.corpus-dialect-atlas.lexical.v1" as const,
    sourceSnapshotIdentity: corpus.snapshotIdentity,
    listingCount: exemplars.length,
    venueCount: venueIds.length,
    predicateFamilyCount: predicateNeighborhoods.length,
    titleFormCount: titleFormNeighborhoods.length,
    componentRoleCueCount: exemplars.filter((item) => item.componentRoleCue).length,
    aggregateRoleCueCount: exemplars.filter((item) => item.aggregateRoleCue).length,
    venueDialects,
    predicateNeighborhoods,
    titleFormNeighborhoods,
    roleNeighborhoods,
    ontologicalPosture:
      "VENUE_TITLE_IS_CONTRACT_SURFACE_LANGUAGE_NOT_CERTIFIED_WORLD_SEMANTICS" as const,
    samplingPosture: "VENUE_DIVERSE_BOUNDED_EXACT_TITLE_EXEMPLARS" as const,
    authority: "LEXICAL_QUERY_RECONNAISSANCE_ONLY" as const,
    subjectIdentityAuthority: false as const,
    semanticDecisionAuthority: false as const,
    probabilityAuthority: false as const,
    schedulingAuthority: false as const,
    certificateAuthority: false as const,
    executionAuthority: false as const,
    effects: Object.freeze({
      providerRequests: false as const,
      externalWrites: false as const,
      valueMovingActions: false as const,
      liveExecutionEnabled: false as const,
    }),
  });
  return Object.freeze({ ...body, atlasIdentity: hashCanonical(body) });
}
