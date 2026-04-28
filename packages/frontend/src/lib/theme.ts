export type ThemeId = 'fresh' | 'classic' | 'graphite' | 'ember';

export type ThemeOption = {
  id: ThemeId;
  nameKey: string;
  swatches: [string, string, string];
};

const STORAGE_KEY = 'kasrat-theme';
const DEFAULT_THEME: ThemeId = 'fresh';

export const themeOptions: ThemeOption[] = [
  {
    id: 'fresh',
    nameKey: 'settings.theme.fresh',
    swatches: ['#0F766E', '#F59E0B', '#E0F2FE'],
  },
  {
    id: 'classic',
    nameKey: 'settings.theme.classic',
    swatches: ['#171717', '#E5E5E5', '#FFFFFF'],
  },
  {
    id: 'graphite',
    nameKey: 'settings.theme.graphite',
    swatches: ['#1F2937', '#2563EB', '#F8FAFC'],
  },
  {
    id: 'ember',
    nameKey: 'settings.theme.ember',
    swatches: ['#9A3412', '#0F766E', '#FFF7ED'],
  },
];

function isThemeId(value: string | null): value is ThemeId {
  return themeOptions.some((theme) => theme.id === value);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemeId(stored) ? stored : DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = 'light';
}

export function saveTheme(theme: ThemeId): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }
  applyTheme(theme);
}

export function applyStoredTheme(): ThemeId {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
