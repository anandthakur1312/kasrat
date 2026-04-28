import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useClerk } from '@clerk/react';
import { Menu } from 'lucide-react';
import type { MemberListItem, MembersListResponse } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';
import { Avatar } from '@/components/avatar';
import { LanguageToggle } from '@/components/language-toggle';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'overdue' | 'expiring' | 'active';

export default function MembersListRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [data, setData] = useState<MembersListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const [gymName, setGymName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [list, gym] = await Promise.all([api.getMembersList(), api.getGym()]);
      setData(list);
      setGymName(gym.name);
    } catch (err) {
      // Newly-signed-in owner who hasn't completed setup yet → /setup.
      if (err instanceof ApiError && err.code === 'NO_GYM') {
        navigate('/setup', { replace: true });
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.members.filter((item) => {
      if (filter === 'overdue') {
        if (item.status !== 'overdue' && item.status !== 'payment_pending') return false;
      } else if (filter === 'expiring') {
        if (item.status !== 'expiring') return false;
      } else if (filter === 'active') {
        if (item.status !== 'active') return false;
      }
      if (q) {
        const hay = `${item.member.name} ${item.member.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, filter, query]);

  const grouped = useMemo(() => {
    const overdue: MemberListItem[] = [];
    const expiring: MemberListItem[] = [];
    const active: MemberListItem[] = [];
    for (const item of filtered) {
      if (item.status === 'overdue' || item.status === 'payment_pending') overdue.push(item);
      else if (item.status === 'expiring') expiring.push(item);
      else active.push(item);
    }
    return { overdue, expiring, active };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top bar */}
      <header className="flex items-start justify-between border-b border-border/60 px-4 pt-4 pb-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.5px] text-muted-foreground font-medium">
            {gymName}
          </div>
          <h1 className="text-[15px] font-medium leading-tight">{t('members.title')}</h1>
        </div>
        <HamburgerMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((v) => !v)}
          onClose={() => setMenuOpen(false)}
        />
      </header>

      <div className="px-4 pt-3 space-y-3">
        {/* Search */}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('members.search')}
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          <FilterChip
            label={t('members.filter.all')}
            count={data?.counts.all}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label={t('members.filter.overdue')}
            count={data?.counts.overdue}
            active={filter === 'overdue'}
            onClick={() => setFilter('overdue')}
          />
          <FilterChip
            label={t('members.filter.expiring')}
            count={data?.counts.expiring}
            active={filter === 'expiring'}
            onClick={() => setFilter('expiring')}
          />
          <FilterChip
            label={t('members.filter.active')}
            count={data?.counts.active}
            active={filter === 'active'}
            onClick={() => setFilter('active')}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="mt-2">
        {loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : error ? (
          <div className="px-4 py-12 text-center space-y-3">
            <div className="text-sm text-overdue-text font-medium">{t('members.error.title')}</div>
            <div className="text-xs text-muted-foreground">{t('members.error.body')}</div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center h-9 px-4 rounded-md border border-border text-sm hover:bg-secondary"
            >
              {t('members.error.retry')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {t('members.empty')}
          </div>
        ) : (
          <>
            <Section
              title={t('members.section.overdue')}
              tone="overdue"
              items={grouped.overdue}
            />
            <Section
              title={t('members.section.expiring')}
              tone="expiring"
              items={grouped.expiring}
            />
            <Section
              title={t('members.section.active')}
              tone="active"
              items={grouped.active}
            />
          </>
        )}
      </div>

      {/* Add member */}
      <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/members/new')}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:bg-primary/80 transition-colors"
        >
          {t('members.add')}
        </button>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-border hover:bg-secondary',
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn('opacity-70', active && 'opacity-90')}>· {count}</span>
      )}
    </button>
  );
}

function Section({
  title,
  tone,
  items,
}: {
  title: string;
  tone: 'overdue' | 'expiring' | 'active';
  items: MemberListItem[];
}) {
  if (items.length === 0) return null;
  const toneClasses =
    tone === 'overdue'
      ? 'text-overdue-text'
      : tone === 'expiring'
        ? 'text-expiring-text'
        : 'text-muted-foreground';
  return (
    <section>
      <div
        className={cn(
          'px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.5px] bg-secondary',
          toneClasses,
        )}
      >
        {title}
      </div>
      <ul className="divide-y divide-border/60">
        {items.map((item) => (
          <MemberRow key={item.member.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function MemberRow({ item }: { item: MemberListItem }) {
  const { t } = useTranslation();

  let statusText = '';
  if (item.status === 'overdue' && item.daysOverdue !== null) {
    statusText = t('members.status.daysOverdue', { count: item.daysOverdue });
  } else if (item.status === 'payment_pending') {
    statusText = t('members.status.paymentPending');
  } else if (
    (item.status === 'expiring' || item.status === 'active') &&
    item.daysRemaining !== null
  ) {
    statusText = t('members.status.daysLeft', { count: item.daysRemaining });
  }

  return (
    <li>
      <Link
        to={`/members/${item.member.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 active:bg-secondary"
      >
        <Avatar name={item.member.name} status={item.status} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight truncate">{item.member.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {item.plan?.name ?? '—'} · {statusText}
          </div>
        </div>
        {item.amountDue !== null && item.status === 'overdue' && (
          <div className="text-sm font-medium text-overdue-text whitespace-nowrap">
            {t('common.currency')}
            {item.amountDue.toLocaleString('en-IN')}
          </div>
        )}
      </Link>
    </li>
  );
}

function HamburgerMenu({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { signOut } = useClerk();
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
        onClick={onToggle}
        aria-label={t('common.menu')}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-10 min-w-[180px] rounded-md border border-border bg-popover shadow-md py-1">
          <MenuItem to="/plans" onClick={onClose}>
            {t('members.menu.plans')}
          </MenuItem>
          <MenuItem to="/settings" onClick={onClose}>
            {t('members.menu.settings')}
          </MenuItem>
          <div className="px-3 py-2 border-t border-border/60 mt-1 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t('members.menu.language')}</span>
            <LanguageToggle />
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              void signOut({ redirectUrl: '/sign-in' });
            }}
            className="w-full text-left block px-3 py-2 text-sm hover:bg-secondary"
          >
            {t('members.menu.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-3 py-2 text-sm text-foreground hover:bg-secondary"
    >
      {children}
    </Link>
  );
}
