import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  AdminAccessRequest,
  AdminGymSummary,
  AccessRequestStatus,
} from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';

type ReviewStatus = Exclude<AccessRequestStatus, 'pending'>;

export default function AdminRoute() {
  const { t } = useTranslation();
  const [gyms, setGyms] = useState<AdminGymSummary[] | null>(null);
  const [requests, setRequests] = useState<AdminAccessRequest[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gs, rs] = await Promise.all([
        api.adminListGyms(),
        api.adminListAccessRequests(),
      ]);
      setGyms(gs);
      setRequests(rs);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('admin.toast.failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, status: ReviewStatus) {
    try {
      await api.adminReviewAccessRequest(id, status);
      toast.success(t('admin.toast.reviewed'));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('admin.toast.failed'));
    }
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="px-4 pt-5 pb-3 border-b border-border/60">
        <h1 className="text-[20px] font-semibold">{t('admin.title')}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t('admin.subtitle')}</p>
      </header>

      <div className="px-4 py-5 space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
              {t('admin.requestsHeading')}
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : requests && requests.length > 0 ? (
            <ul className="rounded-md border border-border divide-y divide-border/60">
              {requests.map((r) => (
                <li key={r.id} className="px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.gymName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.requesterName} · {r.requesterEmail}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.5px] px-2 py-0.5 rounded bg-secondary">
                      {r.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-pre-line">
                    {r.contactPhone}
                    {'\n'}
                    {r.address}
                    {r.note ? `\n${r.note}` : ''}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => void review(r.id, 'approved')}
                        className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary"
                      >
                        {t('admin.reviewApprove')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void review(r.id, 'rejected')}
                        className="h-8 px-3 rounded-md border border-overdue-border text-xs text-overdue-text hover:bg-overdue-bg"
                      >
                        {t('admin.reviewReject')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void review(r.id, 'duplicate')}
                        className="h-8 px-3 rounded-md border border-border text-xs hover:bg-secondary"
                      >
                        {t('admin.reviewDuplicate')}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">{t('admin.noRequests')}</div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
              {t('admin.gymsHeading')}
            </div>
            <Link
              to="/setup"
              className="text-xs h-8 inline-flex items-center px-3 rounded-md bg-primary text-primary-foreground"
            >
              {t('admin.createGym')}
            </Link>
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : gyms && gyms.length > 0 ? (
            <ul className="rounded-md border border-border divide-y divide-border/60">
              {gyms.map((g) => (
                <li key={g.id} className="px-3 py-3">
                  <div className="text-sm font-medium">{g.name}</div>
                  <div className="text-xs text-muted-foreground">
                    /{g.slug} · {g.status} · {t('admin.memberCount', { count: g.memberCount })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {g.createdByName} · {g.createdByEmail}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">{t('admin.noGyms')}</div>
          )}
        </section>
      </div>
    </div>
  );
}
