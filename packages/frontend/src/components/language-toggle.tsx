import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('hi') ? 'hi' : 'en';

  return (
    <div className="inline-flex rounded-full bg-secondary p-0.5 text-xs">
      <button
        type="button"
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
