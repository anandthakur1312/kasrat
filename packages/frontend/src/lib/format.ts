// Format YYYY-MM-DD as "13 Apr 2026" (mirrors local date components, no TZ shift).
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN');
}
