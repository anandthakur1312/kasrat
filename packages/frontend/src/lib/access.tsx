import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@clerk/react';
import type { GymRole, MeAccessResponse, Owner } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';

interface AccessContextValue {
  loading: boolean;
  error: boolean;
  owner: Owner | null;
  gyms: MeAccessResponse['gyms'];
  invites: MeAccessResponse['invites'];
  currentGym: MeAccessResponse['gyms'][number] | null;
  currentRole: GymRole | null;
  isPlatformAdmin: boolean;
  refresh: () => Promise<void>;
}

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<MeAccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setError(false);
    try {
      const next = await api.getMyAccess();
      setData(next);
    } catch (err) {
      // NO_GYM_ACCESS isn't an error here — it means the user is signed in
      // but has no GymUser. The /no-access page handles that state.
      if (err instanceof ApiError && err.code === 'NO_GYM_ACCESS') {
        setData({
          owner: {
            id: '',
            clerkUserId: '',
            name: '',
            email: '',
            phone: null,
            isPlatformAdmin: false,
            createdAt: '',
          },
          gyms: [],
          invites: [],
        });
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  const value = useMemo<AccessContextValue>(() => {
    const gyms = data?.gyms ?? [];
    const invites = data?.invites ?? [];
    const current = gyms[0] ?? null;
    return {
      loading,
      error,
      owner: data?.owner ?? null,
      gyms,
      invites,
      currentGym: current,
      currentRole: current?.role ?? null,
      isPlatformAdmin: data?.owner?.isPlatformAdmin ?? false,
      refresh,
    };
  }, [data, error, loading, refresh]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error('useAccess must be used within AccessProvider');
  }
  return ctx;
}
