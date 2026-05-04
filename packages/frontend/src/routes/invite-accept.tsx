import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';

type State =
  | { kind: 'pending' }
  | { kind: 'accepted'; gymName: string }
  | { kind: 'error'; reason: string };

export default function InviteAcceptRoute() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'pending' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', reason: t('invite.errors.missingToken') });
      return;
    }
    let cancelled = false;
    void api
      .acceptInvite({ token })
      .then((res) => {
        if (cancelled) return;
        setState({ kind: 'accepted', gymName: res.gym.name });
        toast.success(t('invite.toast.success', { name: res.gym.name }));
        // Brief pause so the user sees the success state before landing.
        setTimeout(() => navigate('/', { replace: true }), 1200);
      })
      .catch((err) => {
        if (cancelled) return;
        const reason =
          err instanceof ApiError
            ? err.code === 'INVITE_EMAIL_MISMATCH'
              ? t('invite.errors.emailMismatch')
              : err.code === 'INVITE_EXPIRED'
                ? t('invite.errors.expired')
                : err.code === 'INVITE_NOT_PENDING'
                  ? t('invite.errors.notPending')
                  : err.code === 'INVITE_NOT_FOUND'
                    ? t('invite.errors.notFound')
                    : t('invite.errors.generic')
            : t('invite.errors.generic');
        setState({ kind: 'error', reason });
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate, t]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-4 text-center">
        {state.kind === 'pending' && (
          <p className="text-sm text-muted-foreground">{t('invite.checking')}</p>
        )}
        {state.kind === 'accepted' && (
          <>
            <h1 className="text-xl font-semibold">{t('invite.acceptedTitle')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('invite.acceptedBody', { name: state.gymName })}
            </p>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <h1 className="text-xl font-semibold">{t('invite.problemTitle')}</h1>
            <p className="text-sm text-muted-foreground">{state.reason}</p>
          </>
        )}
      </div>
    </div>
  );
}
