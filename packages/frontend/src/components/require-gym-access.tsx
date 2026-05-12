import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GymRole } from '@gym-app/shared/types';
import { useAccess } from '@/lib/access';

/**
 * Gates a route on having an active gym membership. Redirects to /no-access
 * when the user is signed in but has no GymUser. Optional `roles` enforces
 * the caller's role on top of access — UI hiding only, the backend is the
 * source of truth.
 */
export function RequireGymAccess({
  children,
  roles,
  fallback,
}: {
  children: ReactNode;
  roles?: GymRole[];
  fallback?: string;
}) {
  const { t } = useTranslation();
  const { loading, error, currentGym, currentRole, isPlatformAdmin } = useAccess();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-overdue-text">
        {t('members.error.title')}
      </div>
    );
  }
  if (!currentGym) {
    // Platform admin without a gym goes straight to the admin dashboard.
    if (isPlatformAdmin) return <Navigate to="/admin" replace />;
    return <Navigate to="/no-access" replace />;
  }
  if (roles && currentRole && !roles.includes(currentRole)) {
    return <Navigate to={fallback ?? '/'} replace />;
  }
  return <>{children}</>;
}

/**
 * Gates routes on platform admin status.
 */
export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { loading, isPlatformAdmin } = useAccess();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
