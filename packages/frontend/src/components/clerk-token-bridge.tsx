import { useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { setTokenGetter } from '@/lib/realApi';

/**
 * Mounted once near the root. Plumbs Clerk's `getToken()` (a hook, only
 * usable inside React) into the realApi module's request function so that
 * every fetch picks up a fresh JWT. With no provider mounted (e.g. in
 * mockApi mode or while Clerk is loading), the token getter falls back to
 * returning null and requests go out unauthenticated.
 */
export function ClerkTokenBridge() {
  const { getToken, isLoaded } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    setTokenGetter(() => getToken());
  }, [getToken, isLoaded]);
  return null;
}
