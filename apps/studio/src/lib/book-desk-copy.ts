export type QualifiedBooksTile = Readonly<{
  label: string;
  value: string;
  detail: string;
}>;

export const VENUE_SESSION_PICKER_HEADING = "Select a venue session";
export const SELECTED_VENUE_SESSION_LABEL = "Showing";

export function qualifiedBooksTile(
  books: readonly Readonly<{ bookId: string }>[],
): QualifiedBooksTile {
  const count = books.length;
  return {
    label: "Qualified books",
    value: String(count),
    detail: count === 1 ? "1 venue session" : `${count} venue sessions`,
  };
}

export function selectedVenueSessionLabel(selected: boolean): string | undefined {
  return selected ? SELECTED_VENUE_SESSION_LABEL : undefined;
}
