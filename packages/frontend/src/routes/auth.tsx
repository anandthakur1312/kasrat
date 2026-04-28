import { SignIn, SignUp } from '@clerk/react';
import { LanguageToggle } from '@/components/language-toggle';

/**
 * Sign-in page. Mounted at /sign-in/* (Clerk needs a catch-all suffix
 * for OAuth redirect callbacks).
 */
export function SignInRoute() {
  return (
    <AuthFrame>
      <SignIn
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
      />
    </AuthFrame>
  );
}

/**
 * Sign-up page. Mounted at /sign-up/*.
 */
export function SignUpRoute() {
  return (
    <AuthFrame>
      <SignUp
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/setup"
        fallbackRedirectUrl="/setup"
      />
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex justify-between items-center px-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center text-sm font-bold">
            K
          </div>
          <span className="text-sm font-medium">Kasrat</span>
        </div>
        <LanguageToggle />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
