import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import MembersListRoute from '@/routes/members-list';
import MemberDetailRoute from '@/routes/member-detail';
import RecordPaymentRoute from '@/routes/record-payment';
import AddMemberRoute from '@/routes/add-member';
import EditMemberRoute from '@/routes/edit-member';
import PaymentHistoryRoute from '@/routes/payment-history';
import PlansRoute from '@/routes/plans';
import SettingsRoute from '@/routes/settings';
import AuthRoute from '@/routes/auth';
import SetupRoute from '@/routes/setup';
import PublicGymRoute from '@/routes/public-gym';

const devLinks: Array<{ to: string; label: string }> = [
  { to: '/', label: '/ (members list)' },
  { to: '/members/member-1', label: '/members/:id' },
  { to: '/members/member-1/pay', label: '/members/:id/pay' },
  { to: '/members/new', label: '/members/new' },
  { to: '/plans', label: '/plans' },
  { to: '/settings', label: '/settings' },
  { to: '/login', label: '/login' },
  { to: '/setup', label: '/setup' },
  { to: '/g/gungun', label: '/g/:slug' },
];

function DevNav() {
  if (!import.meta.env.DEV) return null;
  return (
    <nav className="border-b bg-secondary/50 px-3 py-2 text-xs">
      <span className="font-semibold mr-2">DEV:</span>
      <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
        {devLinks.map((l) => (
          <Link key={l.to} to={l.to} className="text-primary underline-offset-2 hover:underline">
            {l.label}
          </Link>
        ))}
      </span>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DevNav />
      <Toaster position="bottom-center" />
      <Routes>
        <Route path="/" element={<MembersListRoute />} />
        <Route path="/login" element={<AuthRoute />} />
        <Route path="/setup" element={<SetupRoute />} />
        <Route path="/members/new" element={<AddMemberRoute />} />
        <Route path="/members/:id" element={<MemberDetailRoute />} />
        <Route path="/members/:id/edit" element={<EditMemberRoute />} />
        <Route path="/members/:id/pay" element={<RecordPaymentRoute />} />
        <Route path="/members/:id/payments" element={<PaymentHistoryRoute />} />
        <Route path="/plans" element={<PlansRoute />} />
        <Route path="/settings" element={<SettingsRoute />} />
        <Route path="/g/:slug" element={<PublicGymRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
