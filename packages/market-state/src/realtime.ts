import type { BookEvent } from "./book.js";

export type NormalizedBookUpdate = Readonly<{
  instrumentId: string;
  event: BookEvent;
  /**
   * True when the event is a fresh full-book image that must be preceded by
   * BEGIN_REBUILD if a valid projection for the instrument already exists.
   */
  requiresRebuild: boolean;
}>;
