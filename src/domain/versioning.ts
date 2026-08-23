export function nextUpdatedAt(previous: string, nowMs: number = Date.now()): string {
  const previousMs = Date.parse(previous);
  if (!Number.isFinite(previousMs)) throw new Error('invalid_previous_updated_at');
  return new Date(Math.max(nowMs, previousMs + 1)).toISOString();
}
