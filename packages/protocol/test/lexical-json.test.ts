import { describe, expect, it } from "vitest";
import { parseJsonWithNumberLexemes } from "../src/index.js";

describe("lexical JSON decoding", () => {
  it("preserves decimals and integers before IEEE-754 conversion", () => {
    expect(
      parseJsonWithNumberLexemes(
        '{"price":0.6993685,"unsafeIdentifier":9007199254740993}',
      ),
    ).toEqual({
      price: "0.6993685",
      unsafeIdentifier: "9007199254740993",
    });
  });
});
