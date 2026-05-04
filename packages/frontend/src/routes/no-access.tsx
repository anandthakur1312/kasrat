import { useTranslation } from 'react-i18next';
import { useClerk } from '@clerk/react';

// Issue #16: shown when the signed-in user has no active GymUser membership.
// Replaces the old "auto-redirect to /setup" behavior — random signups can
// no longer create gyms.
export default function NoAccessRoute() {
  const { t } = useTranslation();
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-5 text-center">
        <h1 className="text-xl font-semibold">{t('noAccess.title')}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('noAccess.body')}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('noAccess.contact')}{' '}
          <a
            href="mailto:hello@kasrat.in"
            className="text-primary underline-offset-2 hover:underline"
          >
            hello@kasrat.in
          </a>
        </p>
        <button
          type="button"
          onClick={() => void signOut({ redirectUrl: '/sign-in' })}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {t('noAccess.signOut')}
        </button>
      </div>
    </div>
  );
}
