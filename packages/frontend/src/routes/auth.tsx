import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/language-toggle';
import { api } from '@/lib/api';

export default function AuthRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleContinue() {
    try {
      const gym = await api.getGym();
      navigate(gym.name ? '/' : '/setup');
    } catch {
      navigate('/setup');
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex justify-end px-4 pt-4">
        <LanguageToggle />
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 max-w-sm mx-auto w-full pb-12">
        <div className="flex justify-center mb-6">
          <div className="h-12 w-12 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center text-lg font-bold">
            G
          </div>
        </div>
        <h1 className="text-center text-[20px] font-semibold leading-tight">
          {t('auth.heading')}
        </h1>
        <p className="text-center text-sm text-muted-foreground mt-1.5">{t('auth.subtitle')}</p>

        <button
          type="button"
          onClick={handleContinue}
          className="mt-6 w-full h-11 rounded-md bg-white text-black border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-secondary"
        >
          <GoogleIcon />
          {t('auth.google')}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">{t('auth.or')}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.email')}
            className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.password')}
            className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleContinue}
            className="flex-1 h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            {t('auth.login')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/setup')}
            className="flex-1 h-11 rounded-md border border-border text-sm font-medium hover:bg-secondary"
          >
            {t('auth.create')}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">{t('auth.terms')}</p>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
