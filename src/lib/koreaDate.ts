const DAY_MS = 86_400_000;
const KST_OFFSET = 9 * 3_600_000;

export function koreaDate(now = Date.now()): string {
  return new Date(now + KST_OFFSET).toISOString().slice(0, 10);
}

export function offsetDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function untilKoreaMidnight(now = Date.now()): number {
  return DAY_MS - (now + KST_OFFSET) % DAY_MS;
}

export function recordTime(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    return value.seconds * 1000 + ('nanoseconds' in value && typeof value.nanoseconds === 'number' ? value.nanoseconds / 1_000_000 : 0);
  }
  return 0;
}

export function formatKoreaTime(value: unknown): string {
  const time = recordTime(value);
  return time ? new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(time) : '시간 미기록';
}
