type JsonParseContext = Readonly<{ source: string }>;

/**
 * Parses JSON while preserving every numeric token as its original source
 * lexeme. Venue codecs can then decide whether a token is an identifier,
 * timestamp, fixed-point amount, or unsupported value without first passing
 * through IEEE-754.
 */
export function parseJsonWithNumberLexemes(text: string): unknown {
  return JSON.parse(
    text,
    (
      _key: string,
      value: unknown,
      context?: JsonParseContext,
    ): unknown => {
      if (typeof value !== "number") {
        return value;
      }
      if (context === undefined) {
        throw new Error("runtime does not expose the JSON numeric source token");
      }
      return context.source;
    },
  );
}
