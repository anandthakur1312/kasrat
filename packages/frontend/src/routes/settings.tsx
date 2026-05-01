import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { slugifySlugInput, validateSlug, type SlugValidationCode } from '@gym-app/shared/reservedSlugs';
import type { Gym } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { OwnerPageHeader } from '@/components/owner-page-header';
import { TimingsEditor } from '@/components/timings-editor';

function slugErrorKey(code: SlugValidationCode | 'SLUG_UNAVAILABLE'): string {
  return code === 'SLUG_RESERVED'
    ? 'common.slugErrors.reserved'
    : code === 'SLUG_UNAVAILABLE'
      ? 'common.slugErrors.unavailable'
      : 'common.slugErrors.format';
}

function apiSlugErrorCode(err: unknown): SlugValidationCode | 'SLUG_UNAVAILABLE' | null {
  if (err instanceof ApiError && err.code?.startsWith('SLUG_')) {
    return err.code as SlugValidationCode | 'SLUG_UNAVAILABLE';
  }
  if (err instanceof Error && err.message.startsWith('SLUG_')) {
    return err.message as SlugValidationCode | 'SLUG_UNAVAILABLE';
  }
  return null;
}

export default function SettingsRoute() {
  const { t } = useTranslation();

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

  const slugValidation = validateSlug(slug);
  const slugIsValid = slugValidation.ok;
  const normalizedSlug = slugValidation.ok ? slugValidation.slug : slug;
  const slugChanged = normalizedSlug !== originalSlug;
  const slugError = slugValidation.ok ? null : t(slugErrorKey(slugValidation.code));

  async function handleSaveClick() {
    if (!slugIsValid) return;
    if (slugChanged) {
      setConfirmSlugOpen(true);
      return;
    }
    await handleSave();
  }

  async function handleSave() {
    if (!gym || !slugIsValid) return;
    setConfirmSlugOpen(false);
    setSaving(true);
    try {
      const updated = await api.updateGym({
        name: name.trim(),
        slug: normalizedSlug,
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
    } catch (err) {
      const slugCode = apiSlugErrorCode(err);
      toast.error(slugCode ? t(slugErrorKey(slugCode)) : t('settings.toast.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <OwnerPageHeader title={t('settings.title')} />

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
                  onChange={(e) => setSlug(slugifySlugInput(e.target.value))}
                  className="flex-1 h-10 bg-background px-3 text-sm focus:outline-none"
                />
              </div>
              {slugError && (
                <div className="mt-1.5 rounded-md bg-overdue-bg text-overdue-text text-xs px-3 py-2">
                  {slugError}
                </div>
              )}
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
            <FieldGroup label={t('settings.timings')}>
              <TimingsEditor initialText={timings} onChange={setTimings} />
            </FieldGroup>
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
          disabled={loading || saving || !slugIsValid}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </div>

      <ConfirmDialog
        open={confirmSlugOpen}
        title={t('settings.slugConfirm.title')}
        body={t('settings.slugConfirm.body', { oldSlug: originalSlug, newSlug: normalizedSlug })}
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

// Same chrome as <Field> but renders as a <div> instead of a <label>, since
// the contents (TimingsEditor) own multiple inputs and shouldn't all wire
// their click events to one label.
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
