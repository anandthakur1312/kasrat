import type { MemberStatus } from '@gym-app/shared/types';
import { cn } from '@/lib/utils';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const statusStyles: Record<MemberStatus, string> = {
  overdue: 'bg-overdue-bg text-overdue-text',
  payment_pending: 'bg-overdue-bg text-overdue-text',
  expiring: 'bg-expiring-bg text-expiring-text',
  active: 'bg-secondary text-secondary-foreground',
};

export function Avatar({
  name,
  status,
  size = 'md',
}: {
  name: string;
  status?: MemberStatus;
  size?: 'sm' | 'md' | 'lg';
}) {
  const styles = status ? statusStyles[status] : 'bg-secondary text-secondary-foreground';
  const dims =
    size === 'lg'
      ? 'h-14 w-14 text-base'
      : size === 'sm'
        ? 'h-8 w-8 text-[11px]'
        : 'h-10 w-10 text-sm';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
        dims,
        styles,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
