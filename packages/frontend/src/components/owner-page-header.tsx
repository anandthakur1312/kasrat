import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Home } from 'lucide-react';

type OwnerPageHeaderProps = {
  title: ReactNode;
  actions?: ReactNode;
};

export function OwnerPageHeader({ title, actions }: OwnerPageHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center border-b border-border/60 px-2 py-2">
      <button
        type="button"
        aria-label={t('common.back')}
        onClick={() => navigate(-1)}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="min-w-0 px-2 text-center text-[15px] font-medium truncate">{title}</h1>

      <div className="flex min-w-9 items-center justify-end gap-1">
        <Link
          to="/"
          aria-label={t('common.home')}
          title={t('common.home')}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
        >
          <Home className="h-5 w-5" />
        </Link>
        {actions}
      </div>
    </header>
  );
}
