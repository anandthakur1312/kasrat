import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  CreateInviteResponse,
  GymRole,
  TeamMember,
  TeamResponse,
} from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';
import { OwnerPageHeader } from '@/components/owner-page-header';
import { useAccess } from '@/lib/access';

export default function TeamRoute() {
  const { t } = useTranslation();
  const { owner } = useAccess();

  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<GymRole>('staff');
  const [sending, setSending] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<CreateInviteResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTeam();
      setTeam(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('team.toast.failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite() {
    if (sending) return;
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      const invite = await api.createInvite({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setCreatedInvite(invite);
      setInviteEmail('');
      toast.success(t('team.toast.inviteCreated'));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('team.toast.failed'));
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await api.revokeInvite(id);
      toast.success(t('team.toast.inviteRevoked'));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('team.toast.failed'));
    }
  }

  async function handleUpdateRole(member: TeamMember, role: GymRole) {
    try {
      await api.updateTeamMember(member.id, { role });
      toast.success(t('team.toast.memberUpdated'));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('team.toast.failed'));
    }
  }

  async function handleToggleStatus(member: TeamMember) {
    try {
      await api.updateTeamMember(member.id, {
        status: member.status === 'active' ? 'disabled' : 'active',
      });
      toast.success(t('team.toast.memberUpdated'));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('team.toast.failed'));
    }
  }

  async function handleRemove(member: TeamMember) {
    try {
      await api.removeTeamMember(member.id);
      toast.success(t('team.toast.memberRemoved'));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('team.toast.failed'));
    }
  }

  async function copyToken() {
    if (!createdInvite) return;
    await navigator.clipboard.writeText(createdInvite.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <OwnerPageHeader title={t('team.title')} />

      <div className="px-4 py-5 space-y-6">
        <p className="text-xs text-muted-foreground -mt-2">{t('team.subtitle')}</p>
        {createdInvite && (
          <div className="rounded-md border border-info-border bg-info-bg/40 text-info-text p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.5px]">
              {t('team.tokenHeading')} · {createdInvite.email}
            </div>
            <pre className="text-xs whitespace-pre-wrap break-all bg-background border border-border rounded px-2 py-2">
              {createdInvite.token}
            </pre>
            <div className="text-xs text-muted-foreground">{t('team.tokenWarning')}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copyToken()}
                className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary"
              >
                {copied ? t('team.tokenCopied') : t('team.tokenCopy')}
              </button>
              <button
                type="button"
                onClick={() => setCreatedInvite(null)}
                className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground"
              >
                {t('team.tokenClose')}
              </button>
            </div>
          </div>
        )}

        <Section title={t('team.inviteTitle')}>
          <Field label={t('team.inviteEmail')}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <Field label={t('team.inviteRole')}>
            <div className="grid grid-cols-2 gap-2">
              <RoleTile
                role="staff"
                active={inviteRole === 'staff'}
                onClick={() => setInviteRole('staff')}
                label={t('team.rolesStaff')}
                help={t('team.roleHelpStaff')}
              />
              <RoleTile
                role="admin"
                active={inviteRole === 'admin'}
                onClick={() => setInviteRole('admin')}
                label={t('team.rolesAdmin')}
                help={t('team.roleHelpAdmin')}
              />
            </div>
          </Field>
          <button
            type="button"
            onClick={() => void handleInvite()}
            disabled={sending || !inviteEmail.trim()}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {t('team.inviteSubmit')}
          </button>
        </Section>

        <Section title={t('team.membersHeading')}>
          {loading ? (
            <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : team && team.members.length > 0 ? (
            <ul className="rounded-md border border-border divide-y divide-border/60">
              {team.members.map((m) => (
                <li key={m.id} className="px-3 py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {m.name}
                        {owner && owner.id === m.ownerId && (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.5px] text-muted-foreground">
                            {t('team.self')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.5px] px-2 py-0.5 rounded bg-secondary text-foreground">
                      {m.role === 'admin' ? t('team.rolesAdmin') : t('team.rolesStaff')}
                      {m.status === 'disabled' ? ' · ✕' : ''}
                    </span>
                  </div>
                  {owner && owner.id !== m.ownerId && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateRole(m, m.role === 'admin' ? 'staff' : 'admin')
                        }
                        className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary"
                      >
                        {m.role === 'admin' ? t('team.actionDemote') : t('team.actionPromote')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(m)}
                        className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary"
                      >
                        {m.status === 'active' ? t('team.actionDisable') : t('team.actionEnable')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemove(m)}
                        className="h-8 px-3 rounded-md border border-overdue-border text-xs text-overdue-text hover:bg-overdue-bg"
                      >
                        {t('team.actionRemove')}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">{t('team.empty')}</div>
          )}
        </Section>

        <Section title={t('team.invitesHeading')}>
          {team && team.invites.length > 0 ? (
            <ul className="rounded-md border border-border divide-y divide-border/60">
              {team.invites.map((inv) => (
                <li
                  key={inv.id}
                  className="px-3 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.role === 'admin' ? t('team.rolesAdmin') : t('team.rolesStaff')} ·{' '}
                      {t('team.expires', { date: new Date(inv.expiresAt).toLocaleDateString() })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(inv.id)}
                    className="h-8 px-3 rounded-md border border-overdue-border text-xs text-overdue-text hover:bg-overdue-bg"
                  >
                    {t('team.actionRevoke')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">{t('team.noInvites')}</div>
          )}
        </Section>
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

function RoleTile({
  active,
  onClick,
  label,
  help,
}: {
  role: GymRole;
  active: boolean;
  onClick: () => void;
  label: string;
  help: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'text-left rounded-md border p-3 transition-colors ' +
        (active
          ? 'border-primary bg-info-bg text-info-text'
          : 'border-border bg-background hover:bg-secondary')
      }
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">{help}</div>
    </button>
  );
}
