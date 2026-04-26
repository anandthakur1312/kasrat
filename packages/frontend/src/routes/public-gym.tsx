import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, MapPin, Phone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { PublicGymResponse } from '@gym-app/shared/types';
import { api } from '@/lib/api';
import { LanguageToggle } from '@/components/language-toggle';

function deriveCity(address: string): string {
  // Address is multi-line; the city/state line tends to be the second line.
  const lines = address.split('\n').map((l) => l.trim()).filter(Boolean);
  const cityLine = lines[1] ?? lines[0] ?? '';
  return cityLine.split(',')[0]?.trim() ?? '';
}

export default function PublicGymRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [data, setData] = useState<PublicGymResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    api
      .getPublicGym(slug)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  if (error || !data) {
    return <div className="p-8 text-sm text-muted-foreground">{t('public.notFound')}</div>;
  }

  const { gym } = data;
  const city = deriveCity(gym.address);
  const upiUrl = (() => {
    const params = new URLSearchParams({
      pa: gym.upiId,
      pn: gym.upiDisplayName,
      cu: 'INR',
    });
    return `upi://pay?${params.toString()}`;
  })();
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(gym.address.replace(/\n/g, ' '))}`;
  const telHref = `tel:${gym.contactPhone.replace(/\s+/g, '')}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-end px-4 pt-4">
        <LanguageToggle />
      </header>

      <main className="px-4 py-6 max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-[22px] font-medium leading-tight">{gym.name}</h1>
          {city && (
            <div className="text-[12px] uppercase tracking-[0.5px] text-muted-foreground mt-1">
              {city}
            </div>
          )}
        </div>

        <section className="rounded-xl bg-secondary p-6 text-center space-y-3">
          <div className="text-sm font-medium">{t('public.payTitle')}</div>
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-md">
              <QRCodeSVG value={upiUrl} size={180} level="M" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{t('public.scan')}</div>
          <div className="text-xs text-muted-foreground">{t('public.upiApps')}</div>
        </section>

        <section className="space-y-3">
          <InfoCard icon={<Clock className="h-[18px] w-[18px]" />} label={t('public.timings')}>
            <div className="text-sm whitespace-pre-line">{gym.timings}</div>
          </InfoCard>

          <InfoCard icon={<MapPin className="h-[18px] w-[18px]" />} label={t('public.address')}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-info-text whitespace-pre-line underline-offset-2 hover:underline"
            >
              {gym.address}
            </a>
          </InfoCard>

          <InfoCard icon={<Phone className="h-[18px] w-[18px]" />} label={t('public.contact')}>
            <a
              href={telHref}
              className="text-sm text-info-text underline-offset-2 hover:underline"
            >
              {gym.contactPhone}
            </a>
          </InfoCard>
        </section>
      </main>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex gap-3">
      <span className="text-muted-foreground mt-0.5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.5px] font-medium text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
