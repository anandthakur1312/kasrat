import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { MemberSession, Plan } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { OwnerPageHeader } from '@/components/owner-page-header';
import { MemberSessionControl } from '@/components/member-session-control';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AddMemberRoute() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [preferredSession, setPreferredSession] = useState<MemberSession>('flexible');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.getPlans().then((list) => {
      if (cancelled) return;
      setPlans(list);
      // Default = cheapest active plan
      const cheapest = [...list].sort((a, b) => a.price - b.price)[0];
      setPlanId(cheapest?.id ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = name.trim() !== '' && phone.trim() !== '' && planId !== null && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !planId) return;
    setSubmitting(true);
    try {
      const created = await api.createMember({
        name: name.trim(),
        phone: phone.trim(),
        planId,
        startDate,
        preferredSession,
      });
      toast.success(t('new.toast.added', { name: created.name }));
      navigate('/');
    } catch {
      toast.error(t('new.toast.failed'));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-h-screen bg-background pb-24 flex flex-col">
      <OwnerPageHeader title={t('new.title')} />

      {loading ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="px-4 py-4 space-y-5">
          <Field label={t('new.name')}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('new.placeholder.name')}
              autoComplete="name"
              required
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>

          <Field label={t('new.phone')}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('new.placeholder.phone')}
              autoComplete="tel"
              required
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>

          <Field label={t('new.plan')}>
            <div className="grid gap-2">
              {plans.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  className={cn(
                    'flex items-center justify-between rounded-md px-4 py-3 text-left transition-colors',
                    p.id === planId
                      ? 'bg-info-bg border-2 border-info-border text-info-text'
                      : 'bg-card border border-border hover:bg-secondary',
                  )}
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <span
                    className={cn(
                      'text-sm',
                      p.id === planId ? 'font-semibold' : 'text-muted-foreground',
                    )}
                  >
                    {t('common.currency')}
                    {formatCurrency(p.price, language)}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('new.startDate')}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
          {t('new.submit')}
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
