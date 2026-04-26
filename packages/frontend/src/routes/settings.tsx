import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { Gym } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/confirm-dialog';

export default function SettingsRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [originalSlug, setOriginalSlug] = useState('');
  const [address, setAddress] = useState('');
  const [timings, setTimings] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiDisplayName, setUpiDisplayName] = useState('');
  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [confirmSlugOpen, setConfirmSlugOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.getGym().then((g) => {
      if (cancelled) return;
      setGym(g);
      setName(g.name);
      setSlug(g.slug);
      setOriginalSlug(g.slug);
      setAddress(g.address);
      setTimings(g.timings);
      setContactPhone(g.contactPhone);
      setUpiId(g.upiId);
      setUpiDisplayName(g.upiDisplayName);
      setGracePeriodDays(g.gracePeriodDays);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveClick() {
    if (slug !== originalSlug) {
      setConfirmSlugOpen(true);
      return;
    }
    await handleSave();
  }

  async function handleSave() {
    if (!gym) return;
    setConfirmSlugOpen(false);
    setSaving(true);
    try {
      const updated = await api.updateGym({
        name: name.trim(),
        slug: slug.trim(),
        address,
        timings,
        contactPhone: contactPhone.trim(),
        upiId: upiId.trim(),
        upiDisplayName: upiDisplayName.trim(),
        gracePeriodDays,
      });
      setGym(updated);
      setOriginalSlug(updated.slug);
      toast.success(t('settings.toast.saved'));
    } catch {
      toast.error(t('settings.toast.failed'));
    } finally {
      setSaving(false);
    }
  }

  const slugChanged = slug !== originalSlug;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => navigate(-1)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[15px] font-medium">{t('settings.title')}</h1>
      </header>

      {loading ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          <Section title={t('settings.section.identity')}>
            <Field label={t('settings.gymName')}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </Field>
            <Field label={t('settings.publicUrl')}>
              <div className="flex items-stretch rounded-md border border-border overflow-hidden">
                <span className="inline-flex items-center px-3 text-xs text-muted-foreground bg-secondary">
                  kasrat.in/g/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 h-10 bg-background px-3 text-sm focus:outline-none"
                />
              </div>
              {slugChanged && (
                <div className="mt-1.5 rounded-md bg-expiring-bg text-expiring-text text-xs px-3 py-2">
                  {t('settings.slugWarning')}
                </div>
              )}
            </Field>
            <button
              type="button"
              onClick={() => window.open(`/g/${originalSlug}`, '_blank')}
              className="inline-flex items-center gap-1.5 text-sm text-info-text underline-offset-2 hover:underline"
            >
              {t('settings.viewPublic')}
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </Section>

          <Section title={t('settings.section.publicInfo')}>
            <Field label={t('settings.address')}>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </Field>
            <Field label={t('settings.timings')}>
              <input
                type="text"
                value={timings}
                onChange={(e) => setTimings(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </Field>
            <Field label={t('settings.contactPhone')}>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </Field>
          </Section>

          <Section title={t('settings.section.payments')}>
            <Field label={t('settings.upiId')}>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </Field>
            <Field label={t('settings.upiDisplayName')}>
              <input
                type="text"
                value={upiDisplayName}
                onChange={(e) => setUpiDisplayName(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </Field>
          </Section>

          <Section title={t('settings.section.overdue')}>
            <Field label={t('settings.gracePeriod')}>
              <div className="inline-flex items-center rounded-md border border-border bg-background h-10 px-3 text-sm">
                <input
                  type="number"
                  inputMode="numeric"
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(Number(e.target.value) || 0)}
                  className="w-16 bg-transparent focus:outline-none"
                />
                <span className="text-muted-foreground">{t('settings.days')}</span>
              </div>
            </Field>
          </Section>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={loading || saving}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmSlugOpen}
        title={t('settings.slugConfirm.title')}
        body={t('settings.slugConfirm.body', { oldSlug: originalSlug, newSlug: slug })}
        confirmLabel={t('settings.slugConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={saving}
        onConfirm={handleSave}
        onCancel={() => setConfirmSlugOpen(false)}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
        {title}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
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
