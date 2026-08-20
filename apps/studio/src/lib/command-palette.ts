export type ProjectionCommand = Readonly<{
  id: string;
  label: string;
}>;

export function filterProjectionCommands<T extends ProjectionCommand>(
  items: readonly T[],
  query: string,
): readonly T[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return items;
  return items.filter((item) => item.label.toLowerCase().includes(needle));
}

export function stepCommandIndex(
  count: number,
  current: number,
  delta: 1 | -1,
): number {
  if (count <= 0) return 0;
  return (current + delta + count) % count;
}
