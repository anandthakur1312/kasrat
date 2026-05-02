import { useTranslation } from 'react-i18next';
import type { MemberSession } from '@gym-app/shared/types';
import { cn } from '@/lib/utils';

const SESSION_OPTIONS: MemberSession[] = ['morning', 'evening', 'flexible'];

interface MemberSessionControlProps {
  value: MemberSession;
  onChange: (value: MemberSession) => void;
}

export function MemberSessionControl({ value, onChange }: MemberSessionControlProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-3 gap-2">
      {SESSION_OPTIONS.map((session) => (
        <button
          key={session}
          type="button"
          aria-pressed={value === session}
          onClick={() => onChange(session)}
          className={cn(
            'h-10 rounded-md border px-3 text-sm font-medium transition-colors',
            value === session
              ? 'border-info-border bg-info-bg text-info-text'
              : 'border-border bg-background text-foreground hover:bg-secondary',
          )}
        >
          {t(`session.${session}`)}
        </button>
      ))}
    </div>
  );
}
