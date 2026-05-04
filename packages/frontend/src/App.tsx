import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import MembersListRoute from '@/routes/members-list';
import MemberDetailRoute from '@/routes/member-detail';
import RecordPaymentRoute from '@/routes/record-payment';
import AddMemberRoute from '@/routes/add-member';
import EditMemberRoute from '@/routes/edit-member';
import PaymentHistoryRoute from '@/routes/payment-history';
import PlansRoute from '@/routes/plans';
import SettingsRoute from '@/routes/settings';
import { SignInRoute, SignUpRoute } from '@/routes/auth';
import SetupRoute from '@/routes/setup';
import PublicGymRoute from '@/routes/public-gym';
import NoAccessRoute from '@/routes/no-access';
import TeamRoute from '@/routes/team';
import InviteAcceptRoute from '@/routes/invite-accept';
import { ClerkTokenBridge } from '@/components/clerk-token-bridge';
import { RequireAuth } from '@/components/require-auth';

const devLinks: Array<{ to: string; label: string }> = [
  { to: '/', label: '/ (members list)' },
  { to: '/members/member-1', label: '/members/:id' },
  { to: '/members/member-1/pay', label: '/members/:id/pay' },
  { to: '/members/new', label: '/members/new' },
  { to: '/plans', label: '/plans' },
  { to: '/settings', label: '/settings' },
  { to: '/sign-in', label: '/sign-in' },
  { to: '/sign-up', label: '/sign-up' },
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
      <ClerkTokenBridge />
      <DevNav />
      <Toaster position="bottom-center" />
      <Routes>
        {/* Public — no auth required */}
        <Route path="/sign-in/*" element={<SignInRoute />} />
        <Route path="/sign-up/*" element={<SignUpRoute />} />
        <Route path="/g/:slug" element={<PublicGymRoute />} />
        {/* Backwards-compat: old /login links land on the new sign-in URL */}
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />

        {/* Protected — Clerk session required */}
        <Route path="/" element={<RequireAuth><MembersListRoute /></RequireAuth>} />
        <Route path="/setup" element={<RequireAuth><SetupRoute /></RequireAuth>} />
        <Route path="/no-access" element={<RequireAuth><NoAccessRoute /></RequireAuth>} />
        <Route path="/invites/:token" element={<RequireAuth><InviteAcceptRoute /></RequireAuth>} />
        <Route path="/team" element={<RequireAuth><TeamRoute /></RequireAuth>} />
        <Route path="/members/new" element={<RequireAuth><AddMemberRoute /></RequireAuth>} />
        <Route path="/members/:id" element={<RequireAuth><MemberDetailRoute /></RequireAuth>} />
        <Route path="/members/:id/edit" element={<RequireAuth><EditMemberRoute /></RequireAuth>} />
        <Route path="/members/:id/pay" element={<RequireAuth><RecordPaymentRoute /></RequireAuth>} />
        <Route path="/members/:id/payments" element={<RequireAuth><PaymentHistoryRoute /></RequireAuth>} />
        <Route path="/plans" element={<RequireAuth><PlansRoute /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsRoute /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}
