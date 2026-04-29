import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

type TimingLine = {
  id: number;
  days: string;
  hours: string;
};

export function buildTimingText(lines: TimingLine[]): string {
  return lines
    .map(({ days, hours }) => {
      const d = days.trim();
      const h = hours.trim();
      if (!d && !h) return '';
      if (!d) return h;
      if (!h) return d;
      return `${d}: ${h}`;
    })
    .filter(Boolean)
    .join('\n');
}

// Best-effort round-trip from a saved timings string back into rows.
// Format produced by buildTimingText is "days: hours" per line; when loading
// legacy freeform text, lines without a colon are treated as days-only so the
// user can split them into hours themselves.
export function parseTimingText(text: string): TimingLine[] {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  return lines.map((line, i) => {
    const colon = line.indexOf(':');
    if (colon === -1) return { id: i + 1, days: line, hours: '' };
    return {
      id: i + 1,
      days: line.slice(0, colon).trim(),
      hours: line.slice(colon + 1).trim(),
    };
  });
}

function defaultLines(t: (key: string) => string): TimingLine[] {
  return [
    { id: 1, days: t('timings.defaults.weekdayDays'), hours: t('timings.defaults.weekdayMorning') },
    { id: 2, days: t('timings.defaults.weekdayDays'), hours: t('timings.defaults.weekdayEvening') },
    { id: 3, days: t('timings.defaults.sundayDays'),  hours: t('timings.defaults.sundayHours')   },
  ];
}

type Props = {
  // Initial text from storage. Read once on mount; later changes do not reset
  // the editor's internal row state. Pass an empty string to start with the
  // localized default rows.
  initialText: string;
  onChange: (text: string) => void;
};

export function TimingsEditor({ initialText, onChange }: Props) {
  const { t } = useTranslation();

  const [lines, setLines] = useState<TimingLine[]>(() => {
    const parsed = parseTimingText(initialText);
    return parsed.length > 0 ? parsed : defaultLines(t);
  });

  // ID of the row whose first input should grab focus on next render
  // (set by addLine; cleared after focus runs).
  const [pendingFocusId, setPendingFocusId] = useState<number | null>(null);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // Emit on every change. The parent owns the persisted string only.
  useEffect(() => {
    onChange(buildTimingText(lines));
    // We deliberately exclude onChange from the deps: parents typically pass
    // an inline setter, and we only want to emit when *rows* change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  useEffect(() => {
    if (pendingFocusId == null) return;
    const el = inputRefs.current.get(pendingFocusId);
    el?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, lines]);

  function update(id: number, field: 'days' | 'hours', value: string) {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  function add() {
    const nextId = lines.reduce((max, l) => Math.max(max, l.id), 0) + 1;
    setLines((prev) => [...prev, { id: nextId, days: '', hours: '' }]);
    setPendingFocusId(nextId);
  }

  function remove(id: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  const preview = buildTimingText(lines);

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="rounded-md border border-border bg-card p-2.5">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)_2.25rem] sm:items-end">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
                  {t('timings.days')}
                </div>
                <input
                  ref={(el) => {
                    if (el) inputRefs.current.set(line.id, el);
                    else inputRefs.current.delete(line.id);
                  }}
                  type="text"
                  value={line.days}
                  onChange={(e) => update(line.id, 'days', e.target.value)}
                  placeholder={t('timings.daysPlaceholder')}
                  className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
                  {t('timings.hours')}
                </div>
                <input
                  type="text"
                  value={line.hours}
                  onChange={(e) => update(line.id, 'hours', e.target.value)}
                  placeholder={t('timings.hoursPlaceholder')}
                  className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
              <button
                type="button"
                aria-label={t('timings.removeLine')}
                onClick={() => remove(line.id)}
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
        onClick={add}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-secondary"
      >
        <Plus className="h-4 w-4" />
        <span>{t('timings.addLine')}</span>
      </button>

      <div className="rounded-md border border-border bg-secondary/50 p-3">
        <div className="text-[10px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
          {t('timings.preview')}
        </div>
        <div className="mt-1 min-h-[52px] whitespace-pre-line text-sm leading-6">
          {preview || (
            <span className="text-muted-foreground">{t('timings.emptyPreview')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
