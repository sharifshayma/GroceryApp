export function partitionLists<T extends { status: string }>(
  lists: T[],
): { open: T[]; completed: T[] } {
  const open: T[] = [];
  const completed: T[] = [];
  for (const l of lists) {
    if (l.status === "completed") completed.push(l);
    else open.push(l); // draft | active
  }
  return { open, completed };
}
