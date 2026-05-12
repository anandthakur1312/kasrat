import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useClerk } from '@clerk/react';
import { toast } from 'sonner';
import type { AccessRequestSummary } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';
import { useAccess } from '@/lib/access';

export default function NoAccessRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { invites, refresh } = useAccess();

  const [token, setToken] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const [gymName, setGymName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const [requests, setRequests] = useState<AccessRequestSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.listMyAccessRequests().then((rs) => {
      if (!cancelled) setRequests(rs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function acceptInvite(inviteToken: string) {
    setRedeeming(true);
    try {
      const result = await api.acceptInvite({ token: inviteToken });
      toast.success(t('access.toast.inviteAccepted', { name: result.gym.name }));
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('access.toast.inviteFailed'));
    } finally {
      setRedeeming(false);
    }
  }

  async function handleRequestSubmit() {
    if (sending) return;
    if (!gymName.trim() || !contactPhone.trim() || !address.trim()) return;
    setSending(true);
    try {
      const created = await api.createAccessRequest({
        gymName: gymName.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        note: note.trim() || undefined,
      });
      toast.success(t('access.toast.requestSent'));
      setRequests([created, ...requests]);
      setGymName('');
      setContactPhone('');
      setAddress('');
      setNote('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('access.toast.requestFailed'));
    } finally {
      setSending(false);
    }
  }

  const latestPending = requests.find((r) => r.status === 'pending');
  const latestApproved = requests.find((r) => r.status === 'approved');
  const latestRejected = requests.find((r) => r.status === 'rejected');

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="px-4 pt-5 pb-3 border-b border-border/60">
        <h1 className="text-[20px] font-semibold">{t('access.noAccessTitle')}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t('access.noAccessBody')}</p>
      </header>

      <div className="px-4 py-5 space-y-6">
        {invites.length > 0 && (
          <Section title={t('access.pendingInvites')}>
            <ul className="rounded-md border border-border divide-y divide-border/60">
              {invites.map((inv) => (
                <li key={inv.id} className="px-3 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{inv.gymName}</div>
                    <div className="text-xs text-muted-foreground">{inv.role}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void acceptInvite('')}
                    disabled
                    className="text-xs px-3 h-8 rounded-md border border-border text-muted-foreground"
                    title="Use the invite link sent to your email"
                  >
                    {t('access.acceptInvite')}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={t('access.redeemTitle')}>
          <p className="text-xs text-muted-foreground -mt-1">{t('access.redeemHelper')}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('access.redeemPlaceholder')}
              className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => void acceptInvite(token.trim())}
              disabled={redeeming || token.trim() === ''}
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {t('access.redeemSubmit')}
            </button>
          </div>
        </Section>

        <Section title={t('access.requestTitle')}>
          <p className="text-xs text-muted-foreground -mt-1">{t('access.requestHelper')}</p>

          {latestPending && (
            <div className="rounded-md bg-info-bg text-info-text text-xs px-3 py-2">
              {t('access.requestPending')}
            </div>
          )}
          {!latestPending && latestApproved && (
            <div className="rounded-md bg-info-bg text-info-text text-xs px-3 py-2">
              {t('access.requestApproved')}
            </div>
          )}
          {!latestPending && !latestApproved && latestRejected && (
            <div className="rounded-md bg-overdue-bg text-overdue-text text-xs px-3 py-2">
              {t('access.requestRejected')}
            </div>
          )}

          <Field label={t('access.requestGymName')}>
            <input
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <Field label={t('access.requestContactPhone')}>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <Field label={t('access.requestAddress')}>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <Field label={t('access.requestNote')}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <button
            type="button"
            onClick={() => void handleRequestSubmit()}
            disabled={
              sending ||
              !!latestPending ||
              gymName.trim() === '' ||
              contactPhone.trim() === '' ||
              address.trim() === ''
            }
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {t('access.requestSubmit')}
          </button>
        </Section>

        <button
          type="button"
          onClick={() => void signOut({ redirectUrl: '/sign-in' })}
          className="w-full h-10 rounded-md border border-border text-sm hover:bg-secondary"
        >
          {t('access.signOut')}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
        {title}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}
