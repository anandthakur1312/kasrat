import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const lang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div className="inline-flex rounded-full bg-secondary p-0.5 text-xs">
      <button
        type="button"
        aria-pressed={lang === 'en'}
        onClick={() => void i18n.changeLanguage('en')}
        className={cn(
          'h-7 px-3 rounded-full font-medium transition-colors',
          lang === 'en' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
        )}
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={lang === 'hi'}
        onClick={() => void i18n.changeLanguage('hi')}
        className={cn(
          'h-7 px-3 rounded-full font-medium transition-colors',
          lang === 'hi' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
        )}
      >
        हिंदी
      </button>
    </div>
  );
}
