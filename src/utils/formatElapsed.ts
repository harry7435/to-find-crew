export function formatElapsed(fromIso: string | null | undefined, nowMs: number = Date.now()): string | null {
  if (!fromIso) return null;
  const fromMs = new Date(fromIso).getTime();
  if (Number.isNaN(fromMs)) return null;
  const diffMs = nowMs - fromMs;
  if (diffMs < 0) return '방금';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours}시간`;
  return `${hours}시간 ${remainder}분`;
}
