import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Two-button cluster used in the top-left of every authenticated screen
// except the members list (which is itself /). Back goes one step in
// history; Home jumps straight to / regardless of how deep the user is.
export function NavBackHome() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={t('common.back')}
        onClick={() => navigate(-1)}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label={t('common.home')}
        onClick={() => navigate('/')}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary"
      >
        <Home className="h-5 w-5" />
      </button>
    </div>
  );
}
