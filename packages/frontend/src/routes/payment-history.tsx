import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import type { MemberDetailResponse, PaymentMethod } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';

export default function PaymentHistoryRoute() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<MemberDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void api.getMemberDetail(id).then((d) => {
      if (cancelled) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => navigate(-1)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[15px] font-medium">{t('detail.history.title')}</h1>
      </header>

      {loading || !data ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          <div className="text-sm text-muted-foreground">
            {data.member.name} · {data.member.phone}
          </div>
          {data.paymentHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground py-3">{t('detail.history.empty')}</div>
          ) : (
            <ul className="rounded-lg border border-border overflow-hidden divide-y divide-border/60">
              {data.paymentHistory.map((p) => (
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
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5 bg-card">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{planName}</div>
        <div className="text-xs text-muted-foreground truncate">
          {formatDate(paidOn, language)} · {t(`payment.method.${method}`)} ·{' '}
          {t('detail.history.recordedBy', { name: recordedByName })}
        </div>
      </div>
      <div className="text-sm font-medium whitespace-nowrap">
        {t('common.currency')}
        {formatCurrency(amount, language)}
      </div>
    </li>
  );
}
