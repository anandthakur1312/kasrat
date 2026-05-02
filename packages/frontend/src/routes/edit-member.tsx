import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { MemberSession } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { MemberSessionControl } from '@/components/member-session-control';
import { OwnerPageHeader } from '@/components/owner-page-header';

export default function EditMemberRoute() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredSession, setPreferredSession] = useState<MemberSession>('flexible');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void api.getMemberDetail(id).then((d) => {
      if (cancelled) return;
      setName(d.member.name);
      setPhone(d.member.phone);
      setPreferredSession(d.member.preferredSession);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const canSubmit = name.trim() !== '' && phone.trim() !== '' && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !canSubmit) return;
    setSubmitting(true);
    try {
      await api.updateMember(id, {
        name: name.trim(),
        phone: phone.trim(),
        preferredSession,
      });
      toast.success(t('edit.toast.saved'));
      navigate(`/members/${id}`);
    } catch {
      toast.error(t('edit.toast.failed'));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-h-screen bg-background pb-24 flex flex-col">
      <OwnerPageHeader title={t('edit.title')} />

      {loading ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="px-4 py-4 space-y-5">
          <Field label={t('edit.name')}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <Field label={t('edit.phone')}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <Field label={t('session.label')}>
            <MemberSessionControl value={preferredSession} onChange={setPreferredSession} />
          </Field>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('edit.save')}
        </button>
      </div>
    </form>
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
