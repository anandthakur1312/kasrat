import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

type PlanDraft = {
  durationMonths: number;
  price: number;
  selected: boolean;
};

type TimingLine = {
  id: number;
  days: string;
  hours: string;
};

const DEFAULT_PLANS: PlanDraft[] = [
  { durationMonths: 1, price: 1000, selected: true },
  { durationMonths: 3, price: 2700, selected: true },
  { durationMonths: 6, price: 5000, selected: true },
  { durationMonths: 12, price: 9000, selected: true },
];

const DEFAULT_TIMING_LINES: TimingLine[] = [
  { id: 1, days: 'Mon-Sat', hours: 'Morning: 6:00 AM - 10:00 AM' },
  { id: 2, days: 'Mon-Sat', hours: 'Evening: 5:00 PM - 9:00 PM' },
  { id: 3, days: 'Sunday', hours: 'Closed' },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function buildTimingText(lines: TimingLine[]): string {
  return lines
    .map((line) => {
      const days = line.days.trim();
      const hours = line.hours.trim();
      if (!days && !hours) return '';
      if (!days) return hours;
      if (!hours) return days;
      return `${days}: ${hours}`;
    })
    .filter(Boolean)
    .join('\n');
}

export default function SetupRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [timingLines, setTimingLines] = useState<TimingLine[]>(DEFAULT_TIMING_LINES);
  const [contactPhone, setContactPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [plans, setPlans] = useState<PlanDraft[]>(DEFAULT_PLANS);
  const [submitting, setSubmitting] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const timings = useMemo(() => buildTimingText(timingLines), [timingLines]);
  const selectedCount = plans.filter((p) => p.selected).length;
  const canSubmit = useMemo(
    () => name.trim() !== '' && effectiveSlug !== '' && selectedCount > 0 && !submitting,
    [name, effectiveSlug, selectedCount, submitting],
  );

  function togglePlan(i: number) {
    setPlans((prev) => prev.map((p, idx) => (idx === i ? { ...p, selected: !p.selected } : p)));
  }

  function updatePrice(i: number, price: number) {
    setPlans((prev) => prev.map((p, idx) => (idx === i ? { ...p, price } : p)));
  }

  function updateTimingLine(id: number, field: 'days' | 'hours', value: string) {
    setTimingLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  function addTimingLine() {
    setTimingLines((prev) => [
      ...prev,
      { id: Math.max(0, ...prev.map((line) => line.id)) + 1, days: '', hours: '' },
    ]);
  }

  function removeTimingLine(id: number) {
    setTimingLines((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((line) => line.id !== id);
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.createGym({
        name: name.trim(),
        slug: effectiveSlug,
        address,
        timings,
        contactPhone: contactPhone.trim(),
        upiId: upiId.trim(),
        plans: plans.filter((p) => p.selected).map(({ durationMonths, price }) => ({ durationMonths, price })),
      });
      toast.success(t('setup.toast.created'));
      navigate('/');
    } catch {
      toast.error(t('setup.toast.failed'));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="px-4 pt-5 pb-3 border-b border-border/60">
        <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
          {t('setup.welcome')}
        </div>
        <h1 className="text-[20px] font-semibold mt-1">{t('setup.title')}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t('setup.subtitle')}</p>
      </header>

      <div className="px-4 py-5 space-y-6">
        <Section title={t('setup.section.gym')}>
          <Field label={t('setup.gymName')}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <Field label={t('setup.publicUrl')}>
            <div className="flex items-stretch rounded-md border border-border overflow-hidden">
              <span className="inline-flex items-center px-3 text-xs text-muted-foreground bg-secondary">
                kasrat.in/g/
              </span>
              <input
                type="text"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                className="flex-1 h-10 bg-background px-3 text-sm focus:outline-none"
              />
            </div>
          </Field>
        </Section>

        <Section title={t('setup.section.publicInfo')}>
          <Field label={t('setup.address')}>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
          <FieldGroup label={t('setup.timings')}>
            <TimingsEditor
              lines={timingLines}
              preview={timings}
              onChange={updateTimingLine}
              onAdd={addTimingLine}
              onRemove={removeTimingLine}
            />
          </FieldGroup>
          <Field label={t('setup.contactPhone')}>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
        </Section>

        <Section title={t('setup.section.payments')}>
          <Field label={t('setup.upiId')}>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@bank"
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </Field>
        </Section>

        <Section title={t('setup.section.plans', { count: selectedCount })}>
          <p className="text-xs text-muted-foreground -mt-1">{t('setup.plansHelper')}</p>
          <div className="grid gap-2">
            {plans.map((p, i) => (
              <PlanTile
                key={p.durationMonths}
                plan={p}
                onToggle={() => togglePlan(i)}
                onPriceChange={(price) => updatePrice(i, price)}
              />
            ))}
          </div>
        </Section>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('setup.submit')}
        </button>
      </div>
    </div>
  );
}

function TimingsEditor({
  lines,
  preview,
  onChange,
  onAdd,
  onRemove,
}: {
  lines: TimingLine[];
  preview: string;
  onChange: (id: number, field: 'days' | 'hours', value: string) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="rounded-md border border-border bg-card p-2.5">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)_2.25rem] sm:items-end">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
                  {t('setup.timing.days')}
                </div>
                <input
                  type="text"
                  value={line.days}
                  onChange={(e) => onChange(line.id, 'days', e.target.value)}
                  placeholder={t('setup.timing.daysPlaceholder')}
                  className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
                  {t('setup.timing.hours')}
                </div>
                <input
                  type="text"
                  value={line.hours}
                  onChange={(e) => onChange(line.id, 'hours', e.target.value)}
                  placeholder={t('setup.timing.hoursPlaceholder')}
                  className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <button
                type="button"
                aria-label={t('setup.timing.removeLine')}
                onClick={() => onRemove(line.id)}
                disabled={lines.length === 1}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-secondary"
      >
        <Plus className="h-4 w-4" />
        <span>{t('setup.timing.addLine')}</span>
      </button>

      <div className="rounded-md border border-border bg-secondary/50 p-3">
        <div className="text-[10px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
          {t('setup.timing.preview')}
        </div>
        <div className="mt-1 min-h-[52px] whitespace-pre-line text-sm leading-6">
          {preview || (
            <span className="text-muted-foreground">{t('setup.timing.emptyPreview')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanTile({
  plan,
  onToggle,
  onPriceChange,
}: {
  plan: PlanDraft;
  onToggle: () => void;
  onPriceChange: (price: number) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(plan.price));

  const label = plan.durationMonths === 1
    ? t('setup.plan.oneMonth')
    : t('setup.plan.nMonths', { count: plan.durationMonths });

  return (
    <div
      onClick={onToggle}
      className={cn(
        'rounded-md border p-3 cursor-pointer transition-colors flex items-center justify-between gap-3',
        plan.selected
          ? 'border-2 border-info-border bg-info-bg text-info-text'
          : 'border-border bg-card hover:bg-secondary',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium">{label}</span>
        {plan.selected && (
          <span className="text-[10px] uppercase tracking-[0.5px] font-semibold px-1.5 py-0.5 rounded bg-info-border text-white">
            {t('setup.selected')}
          </span>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <div className="inline-flex items-center rounded-md border border-border bg-background h-8 px-2 text-sm">
            <span className="text-muted-foreground">{t('common.currency')}</span>
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const n = Number(draft);
                if (!Number.isNaN(n) && n >= 0) onPriceChange(n);
                setEditing(false);
              }}
              className="w-20 bg-transparent text-right focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(plan.price));
              setEditing(true);
            }}
            className={cn(
              'inline-flex items-center rounded-md h-8 px-2.5 text-sm font-medium',
              plan.selected ? 'bg-info-border text-white' : 'bg-secondary text-muted-foreground',
            )}
          >
            {t('common.currency')}
            {formatCurrency(plan.price)}
          </button>
        )}
      </div>
    </div>
  );
}

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
