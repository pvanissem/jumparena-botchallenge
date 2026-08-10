export function addStage(ids: readonly string[]): string[] {
  const last = ids[ids.length - 1] ?? "level-one";
  return [...ids, last];
}

export function removeStage(ids: readonly string[], index: number): string[] {
  if (ids.length <= 1) return [...ids];
  if (index < 0 || index >= ids.length) return [...ids];
  return ids.filter((_, i) => i !== index);
}

export function moveStage(ids: readonly string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function setStage(ids: readonly string[], index: number, levelId: string): string[] {
  if (index < 0 || index >= ids.length) return [...ids];
  const next = [...ids];
  next[index] = levelId;
  return next;
}
