import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';
import { useAccess } from '@/lib/access';

/**
 * Authenticated user lands here from an invite link. We accept the token
 * immediately and forward to the gym. Errors surface in-page rather than
 * silently bouncing the user.
 */
export default function InviteAcceptRoute() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refresh } = useAccess();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    if (!token) {
      setErrorMessage(t('access.toast.inviteFailed'));
      return;
    }
    (async () => {
      try {
        const result = await api.acceptInvite({ token });
        toast.success(t('access.toast.inviteAccepted', { name: result.gym.name }));
        await refresh();
        navigate('/', { replace: true });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : t('access.toast.inviteFailed');
        setErrorMessage(message);
      }
    })();
  }, [navigate, refresh, t, token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-3">
        {errorMessage ? (
          <>
            <h1 className="text-lg font-semibold text-overdue-text">{t('access.toast.inviteFailed')}</h1>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <button
              type="button"
              onClick={() => navigate('/no-access', { replace: true })}
              className="h-9 px-4 rounded-md border border-border text-sm hover:bg-secondary"
            >
              {t('common.back')}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        )}
      </div>
    </div>
  );
}
