const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  if (diff < MINUTE) return 'agora';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `há ${m} min`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `há ${h}h`;
  }
  if (diff < 7 * DAY) {
    const d = Math.floor(diff / DAY);
    return `há ${d}d`;
  }
  try {
    return new Date(timestamp).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}
