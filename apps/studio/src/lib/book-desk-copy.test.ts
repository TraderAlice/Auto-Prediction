import { describe, expect, it } from "vitest";
import {
  qualifiedBooksTile,
  selectedVenueSessionLabel,
  VENUE_SESSION_PICKER_HEADING,
} from "./book-desk-copy.js";

const fourVenueSessions = [
  { bookId: "gemini-predictions:yes" },
  { bookId: "limitless:yes" },
  { bookId: "polymarket-global:yes" },
  { bookId: "polymarket-us:yes" },
] as const;

describe("qualifiedBooksTile", () => {
  it("names the qualified-books tile from the sessions on screen", () => {
    expect(qualifiedBooksTile(fourVenueSessions)).toEqual({
      label: "Qualified books",
      value: "4",
      detail: "4 venue sessions",
    });
  });

  it("does not hardcode a three-transport count", () => {
    expect(qualifiedBooksTile([{ bookId: "gemini-predictions:yes" }])).toEqual({
      label: "Qualified books",
      value: "1",
      detail: "1 venue session",
    });
    expect(qualifiedBooksTile([])).toEqual({
      label: "Qualified books",
      value: "0",
      detail: "0 venue sessions",
    });
  });
});

describe("venue session picker copy", () => {
  it("labels the list as a selector and the selected row as Showing", () => {
    expect(VENUE_SESSION_PICKER_HEADING).toBe("Select a venue session");
    expect(selectedVenueSessionLabel(true)).toBe("Showing");
    expect(selectedVenueSessionLabel(false)).toBeUndefined();
  });
});
