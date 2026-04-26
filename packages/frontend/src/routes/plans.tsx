import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { Plan } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function PlansRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);

  async function refresh() {
    const list = await api.getPlans();
    setPlans(list);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handlePriceChange(id: string, price: number) {
    const original = plans.find((p) => p.id === id);
    if (!original || original.price === price) return;
    try {
      const updated = await api.updatePlan(id, { price });
      setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success(t('plans.toast.priceUpdated'));
    } catch {
      toast.error(t('plans.toast.failed'));
    }
  }

  async function handleArchive(id: string) {
    try {
      await api.updatePlan(id, { isActive: false });
      setPlans((prev) => prev.filter((p) => p.id !== id));
      toast.success(t('plans.toast.archived'));
    } catch {
      toast.error(t('plans.toast.failed'));
    }
  }

  async function handleCreate(durationMonths: number, price: number) {
    try {
      const plan = await api.createPlan({ durationMonths, price });
      setPlans((prev) => [...prev, plan]);
      setShowNewForm(false);
      toast.success(t('plans.toast.created'));
    } catch {
      toast.error(t('plans.toast.failed'));
    }
  }

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
        <h1 className="text-[15px] font-medium">{t('plans.title')}</h1>
      </header>

      <div className="px-4 py-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">{t('plans.helper')}</p>

        {loading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : (
          <ul className="rounded-lg border border-border overflow-hidden divide-y divide-border/60">
            {plans.map((plan) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                onPriceChange={(price) => handlePriceChange(plan.id, price)}
                onArchive={() => handleArchive(plan.id)}
              />
            ))}
          </ul>
        )}

        {showNewForm ? (
          <NewPlanForm
            onCancel={() => setShowNewForm(false)}
            onCreate={handleCreate}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="w-full h-12 rounded-md border-2 border-dashed border-border text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            {t('plans.add')}
          </button>
        )}
      </div>
    </div>
  );
}

function PlanRow({
  plan,
  onPriceChange,
  onArchive,
}: {
  plan: Plan;
  onPriceChange: (price: number) => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  const [price, setPrice] = useState(String(plan.price));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrice(String(plan.price));
  }, [plan.price]);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <li className="flex items-center gap-3 px-4 py-3 bg-card">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{plan.name}</div>
        <div className="text-xs text-muted-foreground">
          {t('plans.usedBy', { count: plan.memberCount ?? 0 })}
        </div>
      </div>
      <div className="inline-flex items-center rounded-md border border-border bg-background h-9 px-2 text-sm">
        <span className="text-muted-foreground">{t('common.currency')}</span>
        <input
          type="number"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => {
            const n = Number(price);
            if (!Number.isNaN(n) && n >= 0) onPriceChange(n);
            else setPrice(String(plan.price));
          }}
          className="w-20 bg-transparent text-right focus:outline-none"
        />
      </div>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          aria-label={t('common.menu')}
          onClick={() => setMenuOpen((v) => !v)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-10 z-10 min-w-[140px] rounded-md border border-border bg-popover shadow-md py-1">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onArchive();
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary"
            >
              {t('plans.menu.archive')}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function NewPlanForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (durationMonths: number, price: number) => void;
}) {
  const { t } = useTranslation();
  const [duration, setDuration] = useState('1');
  const [price, setPrice] = useState('1000');

  const canSave = Number(duration) > 0 && Number(price) >= 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground mb-1.5">
            {t('plans.new.duration')}
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground mb-1.5">
            {t('plans.new.price')}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {t('common.currency')}
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-secondary"
        >
          {t('plans.new.cancel')}
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onCreate(Number(duration), Number(price))}
          className={cn(
            'flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90',
            !canSave && 'opacity-50 cursor-not-allowed',
          )}
        >
          {t('plans.new.save')}
        </button>
      </div>
    </div>
  );
}
