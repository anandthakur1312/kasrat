// Frontend date helpers. Same semantics as the backend's lib/dates.ts —
// YYYY-MM-DD strings interpreted as local-date components, never UTC.
// (See REPORT §6.8 for why: round-tripping through UTC shifts the date
// by one day in negative-offset zones.)

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(d: Date, months: number): Date {
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const parts = s.split('-').map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!);
}
