import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import type {
  AccessResponse,
  GymRole,
  PendingInvite,
  TeamMember,
  TeamResponse,
} from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';
import { OwnerPageHeader } from '@/components/owner-page-header';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cn } from '@/lib/utils';

// Issue #16: gym-admins manage shared access here. Staff are routed away
// from this page (the route is admin-only at the API level too).
export default function TeamRoute() {
  const { t } = useTranslation();
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'forbidden' | 'other' | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const a = await api.getMyAccess();
        if (cancelled) return;
        setAccess(a);
        if (!a.gym || a.role !== 'admin') {
          setError('forbidden');
          setLoading(false);
          return;
        }
        const t0 = await api.getTeam(a.gym.id);
        if (cancelled) return;
        setTeam(t0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'other');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    if (!access?.gym) return;
    setTeam(await api.getTeam(access.gym.id));
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <OwnerPageHeader title={t('team.title')} />
      <div className="px-4 py-4 space-y-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : error === 'forbidden' ? (
          <div className="text-sm text-muted-foreground">{t('team.forbidden')}</div>
        ) : error === 'other' || !team || !access?.gym ? (
          <div className="text-sm text-overdue-text">{t('team.error')}</div>
        ) : (
          <>
            <InviteForm gymId={access.gym.id} onChanged={refresh} />
            <PendingInvitesSection
              gymId={access.gym.id}
              invites={team.invites}
              onChanged={refresh}
            />
            <MembersSection
              gymId={access.gym.id}
              currentOwnerId={access.gym ? team.members.find((m) => m.role === 'admin' && m.status === 'active')?.ownerId ?? null : null}
              members={team.members}
              onChanged={refresh}
            />
          </>
        )}
      </div>
    </div>
  );
}

function InviteForm({
  gymId,
  onChanged,
}: {
  gymId: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<GymRole>('staff');
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<{ rawToken: string; email: string } | null>(null);
  const inviteUrl = useMemo(
    () => (issued ? `${window.location.origin}/invites/${issued.rawToken}` : ''),
    [issued],
  );

  async function handleSubmit() {
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.createInvite(gymId, { email: email.trim(), role });
      setIssued({ rawToken: res.rawToken, email: res.invite.email });
      setEmail('');
      await onChanged();
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === 'ALREADY_MEMBER'
          ? t('team.invite.alreadyMember')
          : t('team.invite.failed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success(t('team.invite.copied'));
  }

  return (
    <section className="space-y-3">
      <h2 className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
        {t('team.invite.title')}
      </h2>
      <div className="space-y-2">
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('team.invite.emailPlaceholder')}
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <div className="grid grid-cols-2 gap-2">
          <RoleTile current={role} value="staff" onClick={() => setRole('staff')} />
          <RoleTile current={role} value="admin" onClick={() => setRole('admin')} />
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!email.trim() || submitting}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {t('team.invite.create')}
        </button>
      </div>
      {issued && (
        <div className="rounded-md border border-info-border bg-info-bg p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.5px] font-semibold text-info-text">
            {t('team.invite.linkHeading', { email: issued.email })}
          </div>
          <div className="flex items-center gap-2 rounded-md bg-background border border-border px-2 py-1.5">
            <code className="flex-1 min-w-0 truncate text-xs">{inviteUrl}</code>
            <button
              type="button"
              onClick={copyLink}
              aria-label={t('team.invite.copy')}
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-secondary"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-info-text/80">{t('team.invite.linkHint')}</p>
        </div>
      )}
    </section>
  );
}

function RoleTile({
  current,
  value,
  onClick,
}: {
  current: GymRole;
  value: GymRole;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={current === value}
      onClick={onClick}
      className={cn(
        'h-10 rounded-md border text-sm font-medium transition-colors',
        current === value
          ? 'border-info-border bg-info-bg text-info-text'
          : 'border-border bg-background text-foreground hover:bg-secondary',
      )}
    >
      {t(`team.role.${value}`)}
    </button>
  );
}

function PendingInvitesSection({
  gymId,
  invites,
  onChanged,
}: {
  gymId: string;
  invites: PendingInvite[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  if (invites.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
        {t('team.pending.title')}
      </h2>
      <ul className="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
        {invites.map((invite) => (
          <li key={invite.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-card">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{invite.email}</div>
              <div className="text-xs text-muted-foreground">{t(`team.role.${invite.role}`)}</div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await api.revokeInvite(gymId, invite.id);
                await onChanged();
              }}
              className="text-xs text-overdue-text underline-offset-2 hover:underline"
            >
              {t('team.pending.revoke')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MembersSection({
  gymId,
  currentOwnerId,
  members,
  onChanged,
}: {
  gymId: string;
  currentOwnerId: string | null;
  members: TeamMember[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [confirmDisable, setConfirmDisable] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);

  async function changeRole(m: TeamMember, role: GymRole) {
    try {
      const next = await api.updateTeamMember(gymId, m.ownerId, { role });
      // No setState here — onChanged refetches; keep callers in one place.
      void next;
      await onChanged();
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === 'LAST_ADMIN'
          ? t('team.errors.lastAdmin')
          : t('team.errors.update'),
      );
    }
  }

  async function disable(m: TeamMember) {
    setBusy(true);
    try {
      await api.updateTeamMember(gymId, m.ownerId, { status: 'disabled' });
      await onChanged();
      setConfirmDisable(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === 'LAST_ADMIN'
          ? t('team.errors.lastAdmin')
          : t('team.errors.update'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
        {t('team.members.title')}
      </h2>
      <ul className="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
        {members.map((m) => {
          const isSelf = m.ownerId === currentOwnerId;
          return (
            <li key={m.ownerId} className="px-3 py-2.5 bg-card space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {m.name}
                    {isSelf && (
                      <span className="ml-1 text-xs text-muted-foreground">{t('team.members.you')}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                </div>
                {m.status === 'disabled' ? (
                  <span className="text-xs text-muted-foreground">{t('team.members.disabled')}</span>
                ) : (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as GymRole)}
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="admin">{t('team.role.admin')}</option>
                    <option value="staff">{t('team.role.staff')}</option>
                  </select>
                )}
              </div>
              {m.status === 'active' && (
                <button
                  type="button"
                  onClick={() => setConfirmDisable(m)}
                  className="text-xs text-overdue-text underline-offset-2 hover:underline"
                >
                  {t('team.members.disable')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirmDisable !== null}
        title={t('team.members.disableConfirm.title')}
        body={t('team.members.disableConfirm.body', { name: confirmDisable?.name ?? '' })}
        confirmLabel={t('team.members.disableConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={busy}
        onConfirm={() => confirmDisable && disable(confirmDisable)}
        onCancel={() => setConfirmDisable(null)}
      />
    </section>
  );
}
