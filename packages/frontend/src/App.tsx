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
import InviteAcceptRoute from '@/routes/invite-accept';
import TeamRoute from '@/routes/team';
import AdminRoute from '@/routes/admin';
import { ClerkTokenBridge } from '@/components/clerk-token-bridge';
import { RequireAuth } from '@/components/require-auth';
import {
  RequireGymAccess,
  RequirePlatformAdmin,
} from '@/components/require-gym-access';
import { AccessProvider } from '@/lib/access';

const devLinks: Array<{ to: string; label: string }> = [
  { to: '/', label: '/ (members list)' },
  { to: '/members/member-1', label: '/members/:id' },
  { to: '/members/member-1/pay', label: '/members/:id/pay' },
  { to: '/members/new', label: '/members/new' },
  { to: '/plans', label: '/plans' },
  { to: '/team', label: '/team' },
  { to: '/settings', label: '/settings' },
  { to: '/no-access', label: '/no-access' },
  { to: '/admin', label: '/admin' },
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
      <AccessProvider>
        <Routes>
          {/* Public — no auth required */}
          <Route path="/sign-in/*" element={<SignInRoute />} />
          <Route path="/sign-up/*" element={<SignUpRoute />} />
          <Route path="/g/:slug" element={<PublicGymRoute />} />
          {/* Backwards-compat: old /login links land on the new sign-in URL */}
          <Route path="/login" element={<Navigate to="/sign-in" replace />} />

          {/* Authenticated, no gym required */}
          <Route
            path="/no-access"
            element={
              <RequireAuth>
                <NoAccessRoute />
              </RequireAuth>
            }
          />
          <Route
            path="/invite/:token"
            element={
              <RequireAuth>
                <InviteAcceptRoute />
              </RequireAuth>
            }
          />
          {/* Setup is platform-admin only now — regular signups go to /no-access. */}
          <Route
            path="/setup"
            element={
              <RequireAuth>
                <RequirePlatformAdmin>
                  <SetupRoute />
                </RequirePlatformAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequirePlatformAdmin>
                  <AdminRoute />
                </RequirePlatformAdmin>
              </RequireAuth>
            }
          />

          {/* Gym-scoped (require active GymUser) */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <RequireGymAccess>
                  <MembersListRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
          <Route
            path="/members/new"
            element={
              <RequireAuth>
                <RequireGymAccess>
                  <AddMemberRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
          <Route
            path="/members/:id"
            element={
              <RequireAuth>
                <RequireGymAccess>
                  <MemberDetailRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
          <Route
            path="/members/:id/edit"
            element={
              <RequireAuth>
                <RequireGymAccess>
                  <EditMemberRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
          <Route
            path="/members/:id/pay"
            element={
              <RequireAuth>
                <RequireGymAccess>
                  <RecordPaymentRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
          <Route
            path="/members/:id/payments"
            element={
              <RequireAuth>
                <RequireGymAccess>
                  <PaymentHistoryRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
          <Route
            path="/plans"
            element={
              <RequireAuth>
                <RequireGymAccess>
                  <PlansRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <RequireGymAccess roles={['admin']}>
                  <SettingsRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
          <Route
            path="/team"
            element={
              <RequireAuth>
                <RequireGymAccess roles={['admin']}>
                  <TeamRoute />
                </RequireGymAccess>
              </RequireAuth>
            }
          />
        </Routes>
      </AccessProvider>
    </BrowserRouter>
  );
}
