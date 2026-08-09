import { hashCanonical } from "@pmh/domain";
import type { DiscoveryTask } from "../src/index.js";

export const TEST_LISTING_REF = "gemini-predictions:GEMI-WEATHER";
export const TEST_LISTING_REF_ALT = "gemini-predictions:GEMI-WEATHER-ALT";
export const TEST_LISTING_REFS = Object.freeze([
  TEST_LISTING_REF,
  TEST_LISTING_REF_ALT,
]);

const contextBody = {
  schemaVersion: "pmh.discovery-catalog-context.v2" as const,
  source: "VERIFIED_FIXTURE_CATALOGS" as const,
  contentPolicy: "UNTRUSTED_VENUE_TEXT_DATA_ONLY" as const,
  listings: [
    {
      listingRef: TEST_LISTING_REF,
      venueId: "gemini-predictions",
      venueInstrumentId: "GEMI-WEATHER",
      title: "Highest temperature in Boston? — 80°F to 81°F",
      description: "A verified fixture listing.",
      status: "OPEN",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      closesAt: "2026-08-01T03:59:00.000Z",
      rulesText: "Resolves yes when the official maximum is 80°F or 81°F.",
      outcomes: [
        { venueOutcomeId: "YES", label: "Yes", indicativePrice: "0.42" },
        { venueOutcomeId: "NO", label: "No", indicativePrice: "0.58" },
      ],
      priceScale: "1000000",
      quantityScale: "1000000",
      minPriceTick: "0.01",
      sourceKind: "VERIFIED_FIXTURE" as const,
      sourceReceivedAt: "2026-07-31T00:00:00.000Z",
      sourceRawHash: `sha256:${"a".repeat(64)}`,
      protocolIdentity: "fixture:test",
    },
    {
      listingRef: TEST_LISTING_REF_ALT,
      venueId: "gemini-predictions",
      venueInstrumentId: "GEMI-WEATHER-ALT",
      title: "Highest temperature in Boston? — 82°F to 83°F",
      description: "A second verified fixture listing.",
      status: "OPEN",
      mechanism: "CENTRALIZED_ORDER_BOOK",
      closesAt: "2026-08-01T03:59:00.000Z",
      rulesText: "Resolves yes when the official maximum is 82°F or 83°F.",
      outcomes: [
        { venueOutcomeId: "YES", label: "Yes", indicativePrice: "0.20" },
        { venueOutcomeId: "NO", label: "No", indicativePrice: "0.80" },
      ],
      priceScale: "1000000",
      quantityScale: "1000000",
      minPriceTick: "0.01",
      sourceKind: "VERIFIED_FIXTURE" as const,
      sourceReceivedAt: "2026-07-31T00:00:00.000Z",
      sourceRawHash: `sha256:${"b".repeat(64)}`,
      protocolIdentity: "fixture:test",
    },
  ],
};

export const agentTask: DiscoveryTask = Object.freeze({
  taskId: "task:model-agent",
  question: "Could this listing encode one temperature interval?",
  venueIds: Object.freeze(["gemini-predictions"]),
  maxHypotheses: 3,
  deadlineEpochMs: Date.now() + 60_000,
  catalogContext: Object.freeze({
    ...contextBody,
    contextIdentity: hashCanonical(contextBody),
  }),
});

export function proposalInput(
  listingRefs: readonly string[] = TEST_LISTING_REFS,
) {
  return {
    thesis: "The verified listings may encode adjacent bounded intervals.",
    strategyKind: "EXHAUSTIVE_RANGE",
    relationKind: "EXHAUSTIVE",
    listingRefs: [...listingRefs],
    claimSearchTerms: ["temperature", "boston"],
    confidenceBps: 6_000,
  };
}

export function deepSeekToolResponse(
  name: string,
  argumentsValue: unknown,
  ordinal: number,
): Response {
  return deepSeekRawToolResponse(
    name,
    JSON.stringify(argumentsValue),
    ordinal,
  );
}

export function deepSeekTextResponse(
  content: string,
  ordinal: number,
  usage = Object.freeze({ prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }),
): Response {
  return Response.json({
    id: `chatcmpl-text-${ordinal}`,
    object: "chat.completion",
    created: 1_785_523_200 + ordinal,
    model: "deepseek-v4-flash",
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
    usage,
  });
}

export function deepSeekRawToolResponse(
  name: string,
  argumentsText: string,
  ordinal: number,
): Response {
  return Response.json({
    id: `chatcmpl-${ordinal}`,
    object: "chat.completion",
    created: 1_785_523_200 + ordinal,
    model: "deepseek-v4-flash",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: `call-${ordinal}`,
          type: "function",
          function: { name, arguments: argumentsText },
        }],
      },
      finish_reason: "tool_calls",
    }],
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  });
}

export function openAiToolResponse(
  name: string,
  argumentsValue: unknown,
  ordinal: number,
): Response {
  return openAiRawToolResponse(name, JSON.stringify(argumentsValue), ordinal);
}

export function openAiRawToolResponse(
  name: string,
  argumentsText: string,
  ordinal: number,
): Response {
  return Response.json({
    id: `resp-${ordinal}`,
    created_at: 1_785_523_200 + ordinal,
    model: "gpt-5.6-luna",
    output: [{
      type: "function_call",
      id: `fc-${ordinal}`,
      call_id: `call-${ordinal}`,
      name,
      arguments: argumentsText,
    }],
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 20,
      output_tokens_details: { reasoning_tokens: 0 },
    },
  });
}

export function openAiStreamToolResponse(
  name: string,
  argumentsValue: unknown,
  ordinal: number,
): Response {
  const callId = `call-${ordinal}`;
  const itemId = `fc-${ordinal}`;
  const argumentsText = JSON.stringify(argumentsValue);
  const events = [
    {
      type: "response.output_item.added",
      output_index: 0,
      item: {
        type: "function_call",
        id: itemId,
        call_id: callId,
        name,
        arguments: "",
      },
    },
    {
      type: "response.output_item.done",
      output_index: 0,
      item: {
        type: "function_call",
        id: itemId,
        call_id: callId,
        name,
        arguments: argumentsText,
        status: "completed",
      },
    },
    {
      type: "response.completed",
      response: {
        usage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 20,
          output_tokens_details: { reasoning_tokens: 5 },
        },
      },
    },
  ];
  return new Response(
    `${events.map((event) => `data: ${JSON.stringify(event)}`).join("\n\n")}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
}

export function scriptedToolCall(ordinal: number): Readonly<{
  name: string;
  input: unknown;
}> {
  if (ordinal === 1) {
    return Object.freeze({
      name: "inspect_listings",
      input: { listingRefs: TEST_LISTING_REFS },
    });
  }
  if (ordinal === 2) {
    return Object.freeze({ name: "record_hypothesis", input: proposalInput() });
  }
  return Object.freeze({
    name: "complete_search",
    input: { reason: "Grounded lead recorded; bounded search complete." },
  });
}
