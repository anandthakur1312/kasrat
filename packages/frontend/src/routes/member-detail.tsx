import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { MemberDetailResponse, PaymentMethod } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function MemberDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<MemberDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    void api.getMemberDetail(id).then((d) => {
      if (cancelled) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleRemove() {
    if (!id) return;
    setRemoving(true);
    try {
      await api.deleteMember(id);
      toast.success(t('detail.toast.removed'));
      navigate('/');
    } catch {
      toast.error(t('detail.toast.removeFailed'));
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="flex items-center justify-between border-b border-border/60 px-2 py-2">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => navigate(-1)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[15px] font-medium">{t('detail.title')}</h1>
        <DetailMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          onClose={() => setMenuOpen(false)}
          onEdit={() => {
            setMenuOpen(false);
            navigate(`/members/${id}/edit`);
          }}
          onRemove={() => {
            setMenuOpen(false);
            setConfirmRemove(true);
          }}
        />
      </header>

      {loading || !data ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <DetailBody data={data} onRecordPayment={() => navigate(`/members/${id}/pay`)} />
      )}

      <ConfirmDialog
        open={confirmRemove}
        title={t('detail.removeConfirm.title')}
        body={t('detail.removeConfirm.body', { name: data?.member.name ?? '' })}
        confirmLabel={t('detail.removeConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        destructive
        busy={removing}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

function DetailMenu({
  open,
  onToggle,
  onClose,
  onEdit,
  onRemove,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t('common.menu')}
        onClick={onToggle}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-10 min-w-[140px] rounded-md border border-border bg-popover shadow-md py-1">
          <button
            type="button"
            onClick={onEdit}
            className="w-full text-left px-3 py-2 text-sm hover:bg-secondary"
          >
            {t('detail.menu.edit')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="w-full text-left px-3 py-2 text-sm text-overdue-text hover:bg-overdue-bg"
          >
            {t('detail.menu.remove')}
          </button>
        </div>
      )}
    </div>
  );
}

function DetailBody({
  data,
  onRecordPayment,
}: {
  data: MemberDetailResponse;
  onRecordPayment: () => void;
}) {
  const { t } = useTranslation();
  const { member, currentMembership, plan, status, daysOverdue, daysRemaining, amountDue, paymentHistory } = data;

  const recentPayments = paymentHistory.slice(0, 5);
  const showViewAll = paymentHistory.length > 5;

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Identity */}
      <section className="flex items-center gap-4">
        <Avatar name={member.name} status={status} size="lg" />
        <div className="min-w-0">
          <div className="text-lg font-medium leading-tight">{member.name}</div>
          <div className="text-sm text-muted-foreground">{member.phone}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t('detail.joined', { date: formatDate(member.joinDate) })}
          </div>
        </div>
      </section>

      {/* Status card */}
      <StatusCard
        status={status}
        daysOverdue={daysOverdue}
        daysRemaining={daysRemaining}
        amountDue={amountDue}
        planName={plan?.name ?? null}
        endDate={currentMembership?.endDate ?? null}
      />

      {/* Queued memberships (issue #5): show what's already paid for after
          the current term so the owner doesn't accidentally double-book it. */}
      {data.queuedMemberships.length > 0 && (
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground mb-2">
            {t('detail.queued.title')}
          </h2>
          <ul className="rounded-lg border border-border overflow-hidden divide-y divide-border/60">
            {data.queuedMemberships.map((m) => (
              <li key={m.id} className="px-3 py-2.5 bg-card text-sm">
                {t('detail.queued.range', {
                  plan: m.planName,
                  start: formatDate(m.startDate),
                  end: formatDate(m.endDate),
                })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Record payment — label is contextual on member status (issue #5).
          payment_pending → first payment; overdue → renewal payment;
          expiring → renew membership; active → add advance renewal. */}
      <button
        type="button"
        onClick={onRecordPayment}
        className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        {t(
          status === 'payment_pending'
            ? 'detail.recordPayment.paymentPending'
            : status === 'overdue'
              ? 'detail.recordPayment.overdue'
              : status === 'expiring'
                ? 'detail.recordPayment.expiring'
                : 'detail.recordPayment.active',
        )}
      </button>

      {/* Payment history */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
            {t('detail.history.title')}
          </h2>
          {showViewAll && (
            <Link
              to={`/members/${data.member.id}/payments`}
              className="text-xs text-foreground underline-offset-2 hover:underline"
            >
              {t('detail.history.viewAll')}
            </Link>
          )}
        </div>
        {recentPayments.length === 0 ? (
          <div className="text-sm text-muted-foreground py-3">{t('detail.history.empty')}</div>
        ) : (
          <ul className="rounded-lg border border-border overflow-hidden divide-y divide-border/60">
            {recentPayments.map((p) => (
              <PaymentRow
                key={p.id}
                planName={p.planName}
                paidOn={p.paidOn}
                method={p.method}
                recordedByName={p.recordedByName}
                amount={p.amount}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusCard({
  status,
  daysOverdue,
  daysRemaining,
  amountDue,
  planName,
  endDate,
}: {
  status: MemberDetailResponse['status'];
  daysOverdue: number | null;
  daysRemaining: number | null;
  amountDue: number | null;
  planName: string | null;
  endDate: string | null;
}) {
  const { t } = useTranslation();

  const tone =
    status === 'overdue' || status === 'payment_pending'
      ? 'bg-overdue-bg text-overdue-text'
      : status === 'expiring'
        ? 'bg-expiring-bg text-expiring-text'
        : 'bg-secondary text-secondary-foreground';

  let header = '';
  let primary = '';
  let secondary = '';

  if (status === 'overdue') {
    header = t('detail.status.overdue');
    primary = t('detail.status.days', { count: daysOverdue ?? 0 });
    secondary = endDate ? t('detail.status.expiredOn', { date: formatDate(endDate) }) : '';
  } else if (status === 'payment_pending') {
    header = t('detail.status.paymentPending');
  } else if (status === 'expiring') {
    header = t('detail.status.expiring');
    primary = t('detail.status.days', { count: daysRemaining ?? 0 });
    secondary = endDate ? t('detail.status.endsOn', { date: formatDate(endDate) }) : '';
  } else if (status === 'active') {
    header = t('detail.status.active');
    primary = t('detail.status.days', { count: daysRemaining ?? 0 });
    secondary = endDate ? t('detail.status.endsOn', { date: formatDate(endDate) }) : '';
  }

  return (
    <div className={cn('rounded-lg p-4', tone)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.5px]">{header}</div>
        {primary && <div className="text-base font-medium">{primary}</div>}
      </div>
      {planName && <div className="text-sm mt-1 opacity-80">{planName}</div>}
      {secondary && <div className="text-xs mt-0.5 opacity-70">{secondary}</div>}
      {amountDue !== null && (
        <div className="text-sm font-medium mt-2">
          {t('common.currency')}
          {formatCurrency(amountDue)}
        </div>
      )}
    </div>
  );
}

function PaymentRow({
  planName,
  paidOn,
  method,
  recordedByName,
  amount,
}: {
  planName: string;
  paidOn: string;
  method: PaymentMethod;
  recordedByName: string;
  amount: number;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5 bg-card">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{planName}</div>
        <div className="text-xs text-muted-foreground truncate">
          {formatDate(paidOn)} · {t(`payment.method.${method}`)} ·{' '}
          {t('detail.history.recordedBy', { name: recordedByName })}
        </div>
      </div>
      <div className="text-sm font-medium whitespace-nowrap">
        {t('common.currency')}
        {formatCurrency(amount)}
      </div>
    </li>
  );
}
