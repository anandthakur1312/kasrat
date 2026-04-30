import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { enUS, hiIN } from '@clerk/localizations';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from '@/lib/i18n';
import App from './App';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

if (!PUBLISHABLE_KEY) {
  // Fail loudly in dev rather than silently rendering a half-broken app.
  // Add VITE_CLERK_PUBLISHABLE_KEY to packages/frontend/.env.
  throw new Error(
    'Missing VITE_CLERK_PUBLISHABLE_KEY. Copy packages/frontend/.env.example to .env and set the value from your Clerk dashboard.',
  );
}

const clerkPublishableKey = PUBLISHABLE_KEY;
const clerkHiIN = {
  ...hiIN,
  formFieldInputPlaceholder__signUpPassword: 'पासवर्ड बनाएँ',
};

function Root() {
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl="/sign-in"
      localization={language === 'hi' ? clerkHiIN : enUS}
    >
      <App />
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
