import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useClerk } from '@clerk/react';
import { Clock3, Menu, Sunrise, Sunset } from 'lucide-react';
import type { MemberListItem, MembersListResponse, MemberSession } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/realApi';
import { Avatar } from '@/components/avatar';
import { LanguageToggle } from '@/components/language-toggle';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAccess } from '@/lib/access';

type StatusFilter = 'all' | 'overdue' | 'expiring' | 'scheduled' | 'active';
type SessionFilter = MemberSession | null;

function gymInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'K';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function MembersListRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [data, setData] = useState<MembersListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>(null);
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
      // Users without a GymUser get bounced to /no-access. RequireGymAccess
      // normally catches this on mount, but a server-side state change while
      // the page is open can still surface it here.
      if (err instanceof ApiError && err.code === 'NO_GYM_ACCESS') {
        navigate('/no-access', { replace: true });
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

  const sessionScopedItems = useMemo(() => {
    if (!data) return [];
    if (sessionFilter === null) return data.members;
    return data.members.filter((item) => item.member.preferredSession === sessionFilter);
  }, [data, sessionFilter]);

  const statusCounts = useMemo(() => {
    if (!data) return null;
    return {
      all: sessionScopedItems.length,
      overdue: sessionScopedItems.filter(
        (i) => i.status === 'overdue' || i.status === 'payment_pending',
      ).length,
      expiring: sessionScopedItems.filter((i) => i.status === 'expiring').length,
      scheduled: sessionScopedItems.filter((i) => i.status === 'scheduled').length,
      active: sessionScopedItems.filter((i) => i.status === 'active').length,
    };
  }, [data, sessionScopedItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessionScopedItems.filter((item) => {
      if (statusFilter === 'overdue') {
        if (item.status !== 'overdue' && item.status !== 'payment_pending') return false;
      } else if (statusFilter === 'expiring') {
        if (item.status !== 'expiring') return false;
      } else if (statusFilter === 'scheduled') {
        if (item.status !== 'scheduled') return false;
      } else if (statusFilter === 'active') {
        if (item.status !== 'active') return false;
      }
      if (q) {
        const hay = `${item.member.name} ${item.member.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessionScopedItems, statusFilter, query]);

  const grouped = useMemo(() => {
    const overdue: MemberListItem[] = [];
    const expiring: MemberListItem[] = [];
    const scheduled: MemberListItem[] = [];
    const active: MemberListItem[] = [];
    for (const item of filtered) {
      if (item.status === 'overdue' || item.status === 'payment_pending') overdue.push(item);
      else if (item.status === 'expiring') expiring.push(item);
      else if (item.status === 'scheduled') scheduled.push(item);
      else active.push(item);
    }
    return { overdue, expiring, scheduled, active };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border/60 bg-secondary/35 px-4 pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-base font-semibold">
              {gymInitials(gymName)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[24px] font-semibold leading-tight">{gymName || t('app.name')}</h1>
            </div>
          </div>
          <HamburgerMenu
            open={menuOpen}
            onToggle={() => setMenuOpen((v) => !v)}
            onClose={() => setMenuOpen(false)}
          />
        </div>
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

        <div className="grid grid-cols-3 gap-2">
          <SessionCard
            session="morning"
            count={data?.sessionCounts.morning}
            active={sessionFilter === 'morning'}
            onClick={() => setSessionFilter((current) => current === 'morning' ? null : 'morning')}
          />
          <SessionCard
            session="evening"
            count={data?.sessionCounts.evening}
            active={sessionFilter === 'evening'}
            onClick={() => setSessionFilter((current) => current === 'evening' ? null : 'evening')}
          />
          <SessionCard
            session="flexible"
            count={data?.sessionCounts.flexible}
            active={sessionFilter === 'flexible'}
            onClick={() => setSessionFilter((current) => current === 'flexible' ? null : 'flexible')}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          <FilterChip
            label={t('members.filter.all')}
            count={statusCounts?.all}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <FilterChip
            label={t('members.filter.overdue')}
            count={statusCounts?.overdue}
            active={statusFilter === 'overdue'}
            onClick={() => setStatusFilter('overdue')}
          />
          <FilterChip
            label={t('members.filter.expiring')}
            count={statusCounts?.expiring}
            active={statusFilter === 'expiring'}
            onClick={() => setStatusFilter('expiring')}
          />
          <FilterChip
            label={t('members.filter.scheduled')}
            count={statusCounts?.scheduled}
            active={statusFilter === 'scheduled'}
            onClick={() => setStatusFilter('scheduled')}
          />
          <FilterChip
            label={t('members.filter.active')}
            count={statusCounts?.active}
            active={statusFilter === 'active'}
            onClick={() => setStatusFilter('active')}
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
              title={t('members.section.scheduled')}
              tone="scheduled"
              items={grouped.scheduled}
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

function SessionCard({
  session,
  count,
  active,
  onClick,
}: {
  session: MemberSession;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const Icon = session === 'morning' ? Sunrise : session === 'evening' ? Sunset : Clock3;

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-w-0 rounded-md border px-3 py-3 text-left transition-colors',
        active
          ? 'border-primary bg-info-bg text-info-text'
          : 'border-border bg-background text-foreground hover:bg-secondary',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-info-text' : 'text-muted-foreground')} />
        <span className="text-lg font-semibold leading-none">{count ?? '—'}</span>
      </div>
      <div className="mt-2 truncate text-xs font-medium">{t(`session.${session}`)}</div>
    </button>
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
  tone: 'overdue' | 'expiring' | 'scheduled' | 'active';
  items: MemberListItem[];
}) {
  if (items.length === 0) return null;
  const toneClasses =
    tone === 'overdue'
      ? 'text-overdue-text'
      : tone === 'expiring'
        ? 'text-expiring-text'
        : tone === 'scheduled'
          ? 'text-info-text'
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
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const sessionLabel = t(`session.${item.member.preferredSession}`);

  let statusText = '';
  if (item.status === 'overdue' && item.daysOverdue !== null) {
    statusText = t('members.status.daysOverdue', { count: item.daysOverdue });
  } else if (item.status === 'payment_pending') {
    statusText = t('members.status.paymentPending');
  } else if (item.status === 'scheduled' && item.currentMembership) {
    statusText = t('members.status.startsOn', {
      date: formatDate(item.currentMembership.startDate, language),
    });
  } else if (
    (item.status === 'expiring' || item.status === 'active') &&
    item.daysRemaining !== null
  ) {
    statusText = t('members.status.daysLeft', { count: item.daysRemaining });
  }
  const meta = [item.plan?.name, statusText, sessionLabel].filter(Boolean).join(' · ');

  return (
    <li>
      <Link
        to={`/members/${item.member.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 active:bg-secondary"
      >
        <Avatar name={item.member.name} status={item.status} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight truncate">{item.member.name}</div>
          <div className="text-xs text-muted-foreground truncate">{meta || '—'}</div>
        </div>
        {item.amountDue !== null && item.status === 'overdue' && (
          <div className="text-sm font-medium text-overdue-text whitespace-nowrap">
            {t('common.currency')}
            {formatCurrency(item.amountDue, language)}
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
  const { currentRole, isPlatformAdmin } = useAccess();
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
          {currentRole === 'admin' && (
            <MenuItem to="/team" onClick={onClose}>
              {t('team.title')}
            </MenuItem>
          )}
          {currentRole === 'admin' && (
            <MenuItem to="/settings" onClick={onClose}>
              {t('members.menu.settings')}
            </MenuItem>
          )}
          {isPlatformAdmin && (
            <MenuItem to="/admin" onClick={onClose}>
              {t('admin.title')}
            </MenuItem>
          )}
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
