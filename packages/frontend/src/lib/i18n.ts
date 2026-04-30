import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import hi from '@/locales/hi.json';

export const SUPPORTED_LANGUAGES = ['en', 'hi'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'kasrat.language';

export function normalizeLanguage(language: string | null | undefined): SupportedLanguage {
  return language?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
}

function readStoredLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (!stored) return null;
  return SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)
    ? (stored as SupportedLanguage)
    : null;
}

function initialLanguage(): SupportedLanguage {
  return readStoredLanguage() ?? normalizeLanguage(
    typeof navigator === 'undefined' ? null : navigator.language,
  );
}

function syncLanguage(language: string) {
  const normalized = normalizeLanguage(language);
  if (typeof document !== 'undefined') document.documentElement.lang = normalized;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  }
}

i18n.on('languageChanged', syncLanguage);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: { escapeValue: false },
}).then(() => syncLanguage(i18n.resolvedLanguage ?? i18n.language));

export default i18n;
