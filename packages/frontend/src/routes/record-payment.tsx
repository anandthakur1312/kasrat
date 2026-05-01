import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import type { Gym, MemberDetailResponse, MemberStatus, PaymentMethod, Plan } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import { formatCurrency, formatDate } from '@/lib/format';
import { addMonths, iso, parseDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function includeCurrentPlan(planList: Plan[], currentPlan: Plan | null): Plan[] {
  if (!currentPlan || planList.some((p) => p.id === currentPlan.id)) return planList;
  return [currentPlan, ...planList];
}

export default function RecordPaymentRoute() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();

  const [detail, setDetail] = useState<MemberDetailResponse | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);

  // Derived helpers — null until the detail loads.
  const member = detail?.member ?? null;
  const status: MemberStatus | null = detail?.status ?? null;

  const [planId, setPlanId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [paidOn, setPaidOn] = useState<string>(todayISO());
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void Promise.all([
      api.getMemberDetail(id),
      api.getPlans(),
      api.getGym(),
    ]).then(([detailData, planList, gymData]) => {
      if (cancelled) return;
      const paymentPlans = includeCurrentPlan(planList, detailData.plan);
      setDetail(detailData);
      setPlans(paymentPlans);
      setGym(gymData);
      // Default plan: previous plan if any, else first active plan. Archived
      // current plans are included above so first payments do not default to 0.
      const defaultPlan = detailData.plan?.id ?? paymentPlans[0]?.id ?? null;
      setPlanId(defaultPlan);
      const defaultPrice = paymentPlans.find((p) => p.id === defaultPlan)?.price ?? 0;
      setAmount(String(defaultPrice));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // When plan changes, sync amount to plan price (unless user has manually edited).
  function handlePlanChange(newId: string) {
    setPlanId(newId);
    const plan = plans.find((p) => p.id === newId);
    if (plan) setAmount(String(plan.price));
  }

  const refNote = member ? `GYM-MEM-${member.id}` : '';
  const isAdvanceRenewal = status === 'active';
  const isScheduledPayment = status === 'scheduled';

  // Issue #5: when an active member pays, the new membership queues
  // *after* the latest non-cancelled end (current or any queued one).
  // Compute the prospective range so the UI can show the owner exactly
  // what they're scheduling.
  const latestNonCancelledEnd = useMemo<string | null>(() => {
    if (!detail) return null;
    const ends: string[] = [];
    if (detail.currentMembership) ends.push(detail.currentMembership.endDate);
    for (const m of detail.queuedMemberships) ends.push(m.endDate);
    if (ends.length === 0) return null;
    return ends.reduce((max, e) => (e > max ? e : max), ends[0]!);
  }, [detail]);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const changePlans = selectedPlan ? plans.filter((p) => p.id !== selectedPlan.id) : plans;
  const latestAllowedPaidOn = todayISO();
  const isFuturePaidOn = paidOn > latestAllowedPaidOn;
  const renewalPreview = useMemo(() => {
    if (!isAdvanceRenewal || !latestNonCancelledEnd || !selectedPlan) return null;
    const start = parseDate(latestNonCancelledEnd);
    const end = addMonths(start, selectedPlan.durationMonths);
    return { start: iso(start), end: iso(end) };
  }, [isAdvanceRenewal, latestNonCancelledEnd, selectedPlan]);

  const upiUrl = useMemo(() => {
    if (!gym) return '';
    const params = new URLSearchParams({
      pa: gym.upiId,
      pn: gym.upiDisplayName,
      am: amount || '0',
      tn: refNote,
      cu: 'INR',
    });
    return `upi://pay?${params.toString()}`;
  }, [gym, amount, refNote]);

  async function handleConfirm() {
    if (!member || !planId || submitting) return;
    if (!paidOn || isFuturePaidOn) {
      toast.error(t('pay.toast.futureDate'));
      return;
    }
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) return;
    setSubmitting(true);
    try {
      await api.recordPayment({
        memberId: member.id,
        planId,
        amount: numericAmount,
        method,
        paidOn,
      });
      toast.success(t('pay.toast.recorded'));
      navigate(`/members/${member.id}`);
    } catch {
      toast.error(t('pay.toast.failed'));
      setSubmitting(false);
    }
  }

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
        <h1 className="text-[15px] font-medium">
          {t(
            isScheduledPayment
              ? 'pay.titleScheduled'
              : isAdvanceRenewal
                ? 'pay.titleAdvance'
                : 'pay.title',
          )}
        </h1>
      </header>

      {loading || !member || !gym ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="px-4 py-4 space-y-5">
          {/* Member context strip */}
          <div className="flex items-center gap-3">
            <Avatar name={member.name} size="md" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{member.name}</div>
              <div className="text-xs text-muted-foreground truncate">{member.phone}</div>
            </div>
          </div>

          {/* Advance-renewal context card (issue #5).
              Only shown for active members so the owner sees that this
              payment queues a *future* membership rather than extending
              the current one. */}
          {isAdvanceRenewal && detail?.currentMembership && (
            <section className="rounded-lg bg-info-bg text-info-text px-4 py-3 space-y-1.5">
              <div className="text-[11px] uppercase tracking-[0.5px] font-semibold">
                {t('pay.advanceRenewal.heading')}
              </div>
              <p className="text-sm leading-relaxed">
                {t('pay.advanceRenewal.explainer')}
              </p>
              <p className="text-xs leading-relaxed opacity-90">
                {t('pay.advanceRenewal.currentEnds', {
                  date: formatDate(detail.currentMembership.endDate, language),
                })}
                {renewalPreview && selectedPlan && (
                  <>
                    {' '}
                    {t('pay.advanceRenewal.nextRange', {
                      plan: selectedPlan.name,
                      start: formatDate(renewalPreview.start, language),
                      end: formatDate(renewalPreview.end, language),
                    })}
                  </>
                )}
              </p>
            </section>
          )}

          {isScheduledPayment && detail?.currentMembership && (
            <section className="rounded-lg bg-info-bg text-info-text px-4 py-3 space-y-1.5">
              <div className="text-[11px] uppercase tracking-[0.5px] font-semibold">
                {t('pay.scheduled.heading')}
              </div>
              <p className="text-sm leading-relaxed">
                {t('pay.scheduled.explainer', {
                  date: formatDate(detail.currentMembership.startDate, language),
                })}
              </p>
              {selectedPlan && (
                <p className="text-xs leading-relaxed opacity-90">
                  {t('pay.scheduled.plan', { plan: selectedPlan.name })}
                </p>
              )}
            </section>
          )}

          {/* Plan picker */}
          <section className="space-y-3">
            {selectedPlan && (
              <div>
                <Label>{t('pay.selectedPlan')}</Label>
                <PlanTile plan={selectedPlan} selected />
              </div>
            )}

            {changePlans.length > 0 && (
              <div>
                <Label>{selectedPlan ? t('pay.changePlan') : t('pay.plan')}</Label>
                <div className="grid gap-2">
                  {changePlans.map((p) => (
                    <PlanTile
                      key={p.id}
                      plan={p}
                      selected={false}
                      onClick={() => handlePlanChange(p.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Amount + Date row */}
          <section className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('pay.amount')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {t('common.currency')}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-10 rounded-md border border-border bg-background pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>
            <div>
              <Label>{t('pay.date')}</Label>
              <input
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                max={latestAllowedPaidOn}
                aria-invalid={isFuturePaidOn}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </section>

          {/* Method picker */}
          <section>
            <Label>{t('pay.method')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <MethodTile
                method="upi"
                selected={method === 'upi'}
                onClick={() => setMethod('upi')}
              />
              <MethodTile
                method="cash"
                selected={method === 'cash'}
                onClick={() => setMethod('cash')}
              />
              <MethodTile
                method="other"
                selected={method === 'other'}
                onClick={() => setMethod('other')}
              />
            </div>
          </section>

          {method === 'upi' && (
            <section className="rounded-lg bg-secondary p-4 text-center space-y-2">
              <div className="text-[11px] uppercase tracking-[0.5px] text-muted-foreground font-medium">
                {t('pay.qr.label')}
              </div>
              <div className="flex justify-center py-2">
                <div className="bg-white p-3 rounded-md">
                  <QRCodeSVG value={upiUrl} size={180} level="M" />
                </div>
              </div>
              <div className="text-sm font-medium">
                {t('pay.qr.amountTo', {
                  currency: t('common.currency'),
                  amount: formatCurrency(Number(amount) || 0, language),
                  name: gym.upiDisplayName,
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('pay.qr.ref', { ref: refNote })}
              </div>
              <div className="text-xs text-muted-foreground">{t('pay.qr.scan')}</div>
            </section>
          )}
        </div>
      )}

      {/* Confirm button */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || loading || !planId || !paidOn || isFuturePaidOn}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {method === 'cash' ? t('pay.confirmCash') : t('pay.confirmReceived')}
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground mb-1.5">
      {children}
    </div>
  );
}

function PlanTile({
  plan,
  selected,
  onClick,
}: {
  plan: Plan;
  selected: boolean;
  onClick?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const className = cn(
    'flex w-full items-center justify-between rounded-md px-4 py-3 text-left transition-colors',
    selected
      ? 'bg-info-bg border-2 border-info-border text-info-text'
      : 'bg-card border border-border hover:bg-secondary',
  );
  const content = (
    <>
      <span className="text-sm font-medium">{plan.name}</span>
      <span className={cn('text-sm', selected ? 'font-semibold' : 'text-muted-foreground')}>
        {t('common.currency')}
        {formatCurrency(plan.price, language)}
      </span>
    </>
  );

  if (!onClick) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
    >
      {content}
    </button>
  );
}

function MethodTile({
  method,
  selected,
  onClick,
}: {
  method: PaymentMethod;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-12 rounded-md text-sm font-medium transition-colors',
        selected
          ? 'bg-info-bg border-2 border-info-border text-info-text'
          : 'bg-card border border-border hover:bg-secondary',
      )}
    >
      {t(`payment.method.${method}`)}
    </button>
  );
}
