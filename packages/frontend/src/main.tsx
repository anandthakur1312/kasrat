import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import '@/lib/i18n';
import { applyStoredTheme } from '@/lib/theme';
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

applyStoredTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/sign-in">
      <App />
    </ClerkProvider>
  </StrictMode>,
);
