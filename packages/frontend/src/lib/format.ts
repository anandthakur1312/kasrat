import { normalizeLanguage } from '@/lib/i18n';

export function localeForLanguage(language: string | null | undefined): string {
  return normalizeLanguage(language) === 'hi' ? 'hi-IN' : 'en-IN';
}

// Format YYYY-MM-DD using local date components, with no TZ shift.
export function formatDate(iso: string, language?: string | null): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatCurrency(amount: number, language?: string | null): string {
  return amount.toLocaleString(localeForLanguage(language));
}
