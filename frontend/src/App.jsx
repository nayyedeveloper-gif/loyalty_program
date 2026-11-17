import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PanelLayout from './components/PanelLayout'
import PwaInstallBanner from './components/PwaInstallBanner'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import AdminDashboard from './pages/admin/Dashboard'
import AdminCustomers from './pages/admin/Customers'
import AdminPurchases from './pages/admin/Purchases'
import AdminRewards from './pages/admin/Rewards'
import AdminRedemptions from './pages/admin/Redemptions'
import AdminPromotions from './pages/admin/Promotions'
import AdminMissions from './pages/admin/Missions'
import AdminLedger from './pages/admin/Ledger'
import AdminFeedback from './pages/admin/Feedback'
import AdminFaqs from './pages/admin/Faqs'
import AdminStaff from './pages/admin/Staff'
import AdminActivityLogs from './pages/admin/ActivityLogs'
import AdminReferrals from './pages/admin/Referrals'
import AdminWinback from './pages/admin/Winback'
import CustomerMembership from './pages/customer/Membership'
import CustomerHistory from './pages/customer/History'
import PointsActivity from './pages/customer/PointsActivity'
import CustomerRewards from './pages/customer/Rewards'
import CustomerMissions from './pages/customer/Missions'
import CustomerCommunity from './pages/customer/Community'
import CustomerReviews from './pages/customer/Reviews'
import Settings from './pages/Settings'
import HelpFeedback from './pages/HelpFeedback'
import Notifications from './pages/Notifications'
import CustomerSpin from './modules/spinwheel/pages/CustomerSpin'
import GuestSpin from './modules/spinwheel/pages/GuestSpin'
import AdminSpinDashboard from './modules/spinwheel/pages/admin/AdminSpinDashboard'
import AdminSpinWheel from './modules/spinwheel/pages/admin/AdminSpinWheel'
import AdminSpinPrizes from './modules/spinwheel/pages/admin/AdminSpinPrizes'
import AdminSpinUsage from './modules/spinwheel/pages/admin/AdminSpinUsage'
import AdminSpinRewards from './modules/spinwheel/pages/admin/AdminSpinRewards'
import AdminGuestSpins from './modules/spinwheel/pages/admin/AdminGuestSpins'
import {
  faBell,
  faBoxOpen,
  faChartLine,
  faCircleQuestion,
  faClipboardList,
  faCrown,
  faDice,
  faEnvelopeOpenText,
  faGear,
  faGem,
  faPercent,
  faReceipt,
  faShoppingBag,
  faTrophy,
  faUsers,
} from './lib/icons'

const staffLinks = [
  { to: '/admin/customers', labelKey: 'customers', icon: faUsers },
  { to: '/admin/purchases', labelKey: 'purchases', icon: faBoxOpen },
  { to: '/admin/redemptions', labelKey: 'rewardRedemptions', icon: faReceipt },
  { to: '/admin/ledger', labelKey: 'pointsLedger', icon: faGem },
  { to: '/admin/notifications', labelKey: 'notifications', icon: faBell },
  { to: '/admin/settings/general', labelKey: 'settings', icon: faGear },
]

const adminLinks = [
  { to: '/admin', labelKey: 'dashboard', end: true, icon: faChartLine },
  ...staffLinks.slice(0, 4),
  {
    to: '/admin/spinwheel',
    labelKey: 'spinwheel',
    icon: faDice,
    children: [
      { to: '/admin/spinwheel', labelKey: 'spinwheelOverview', end: true },
      { to: '/admin/spinwheel/wheel', labelKey: 'spinwheelConfig' },
      { to: '/admin/spinwheel/usage', labelKey: 'spinwheelUsage' },
      { to: '/admin/spinwheel/rewards', labelKey: 'spinwheelRewards' },
      { to: '/admin/spinwheel/guest-spins', labelKey: 'spinwheelGuestSpins' },
    ],
  },
  { to: '/admin/rewards', labelKey: 'rewardsCatalog', icon: faShoppingBag },
  { to: '/admin/promotions', labelKey: 'promotions', icon: faPercent },
  { to: '/admin/missions', labelKey: 'manageMissions', icon: faTrophy },
  { to: '/admin/help', labelKey: 'customerFeedback', icon: faEnvelopeOpenText },
  { to: '/admin/faqs', labelKey: 'manageFaqs', icon: faCircleQuestion },
  { to: '/admin/referrals', labelKey: 'referralDashboard', icon: faUsers },
  { to: '/admin/winback', labelKey: 'winbackCampaign', icon: faGem },
  { to: '/admin/staff', labelKey: 'staffAccounts', icon: faUsers },
  { to: '/admin/activity-logs', labelKey: 'activityLogs', icon: faClipboardList },
  { to: '/admin/notifications', labelKey: 'notifications', icon: faBell },
  { to: '/admin/settings/general', labelKey: 'settings', icon: faGear },
]

const customerLinks = [
  { to: '/app', labelKey: 'membership', end: true, icon: faCrown },
  { to: '/app/spinwheel', labelKey: 'spinwheel', icon: faDice },
  { to: '/app/history', labelKey: 'purchaseHistory', icon: faReceipt },
  { to: '/app/points', labelKey: 'pointsActivity', icon: faGem },
  { to: '/app/rewards', labelKey: 'rewardsCatalog', icon: faShoppingBag },
  { to: '/app/missions', labelKey: 'missions', icon: faTrophy },
  { to: '/app/community', labelKey: 'communityHub', icon: faUsers },
  { to: '/app/notifications', labelKey: 'notifications', icon: faBell },
]

function PortalLayout() {
  const { isAdmin } = useAuth()
  const links = isAdmin ? adminLinks : staffLinks
  const titleKey = isAdmin ? 'adminPortal' : 'staffPortal'
  return <PanelLayout titleKey={titleKey} links={links} />
}

export default function App() {
  return (
    <>
      <PwaInstallBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route element={<ProtectedRoute roles={['admin', 'staff']} />}>
          <Route element={<PortalLayout />}>
            <Route path="/admin" element={<AdminOnly><AdminDashboard /></AdminOnly>} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/purchases" element={<AdminPurchases />} />
            <Route path="/admin/spinwheel" element={<AdminOnly><AdminSpinDashboard /></AdminOnly>} />
            <Route path="/admin/spinwheel/wheel" element={<AdminOnly><AdminSpinWheel /></AdminOnly>} />
            <Route path="/admin/spinwheel/prizes/:id" element={<AdminOnly><AdminSpinPrizes /></AdminOnly>} />
            <Route path="/admin/spinwheel/usage" element={<AdminOnly><AdminSpinUsage /></AdminOnly>} />
            <Route path="/admin/spinwheel/rewards" element={<AdminOnly><AdminSpinRewards /></AdminOnly>} />
            <Route path="/admin/spinwheel/guest-spins" element={<AdminOnly><AdminGuestSpins /></AdminOnly>} />
            <Route path="/admin/rewards" element={<AdminOnly><AdminRewards /></AdminOnly>} />
            <Route path="/admin/redemptions" element={<AdminRedemptions />} />
            <Route path="/admin/promotions" element={<AdminOnly><AdminPromotions /></AdminOnly>} />
            <Route path="/admin/missions" element={<AdminOnly><AdminMissions /></AdminOnly>} />
            <Route path="/admin/ledger" element={<AdminLedger />} />
            <Route path="/admin/help" element={<AdminOnly><AdminFeedback /></AdminOnly>} />
            <Route path="/admin/faqs" element={<AdminOnly><AdminFaqs /></AdminOnly>} />
            <Route path="/admin/referrals" element={<AdminOnly><AdminReferrals /></AdminOnly>} />
            <Route path="/admin/winback" element={<AdminOnly><AdminWinback /></AdminOnly>} />
            <Route path="/admin/staff" element={<AdminOnly><AdminStaff /></AdminOnly>} />
            <Route path="/admin/activity-logs" element={<AdminOnly><AdminActivityLogs /></AdminOnly>} />
            <Route path="/admin/notifications" element={<Notifications />} />
            <Route path="/admin/settings" element={<Navigate to="/admin/settings/general" replace />} />
            <Route path="/admin/settings/:section" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="customer" />}>
          <Route element={<PanelLayout titleKey="memberApp" links={customerLinks} />}>
            <Route path="/app" element={<CustomerMembership />} />
            <Route path="/app/spinwheel" element={<CustomerSpin />} />
            <Route path="/app/history" element={<CustomerHistory />} />
            <Route path="/app/points" element={<PointsActivity />} />
            <Route path="/app/rewards" element={<CustomerRewards />} />
            <Route path="/app/missions" element={<CustomerMissions />} />
            <Route path="/app/reviews" element={<CustomerReviews />} />
            <Route path="/app/community" element={<CustomerCommunity />} />
            <Route path="/app/notifications" element={<Notifications />} />
            <Route path="/app/profile" element={<Navigate to="/app/settings/profile" replace />} />
            <Route path="/app/settings" element={<Navigate to="/app/settings/general" replace />} />
            <Route path="/app/settings/:section" element={<Settings />} />
            <Route path="/app/help" element={<HelpFeedback />} />
          </Route>
        </Route>

        <Route path="/guest/:token" element={<GuestSpin />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function AdminOnly({ children }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/admin/purchases" replace />
  return children
}
