import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PanelLayout from './components/PanelLayout'
import PwaInstallBanner from './components/PwaInstallBanner'
import Landing from './pages/Landing'
import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import AdminDashboard from './pages/admin/Dashboard'
import AdminCustomers from './pages/admin/Customers'
import AdminPurchases from './pages/admin/Purchases'
import CustomerMembership from './pages/customer/Membership'
import CustomerHistory from './pages/customer/History'
import PointsActivity from './pages/customer/PointsActivity'
import CustomerRewards from './pages/customer/Rewards'
import CustomerMissions from './pages/customer/Missions'
import CustomerReviews from './pages/customer/Reviews'
import CustomerCommunity from './pages/customer/Community'
import Settings from './pages/Settings'
import HelpFeedback from './pages/HelpFeedback'
import CustomerSpin from './modules/spinwheel/pages/CustomerSpin'
import GuestSpin from './modules/spinwheel/pages/GuestSpin'
import AdminSpinDashboard from './modules/spinwheel/pages/admin/AdminSpinDashboard'
import AdminSpinWheel from './modules/spinwheel/pages/admin/AdminSpinWheel'
import AdminSpinPrizes from './modules/spinwheel/pages/admin/AdminSpinPrizes'
import AdminSpinUsage from './modules/spinwheel/pages/admin/AdminSpinUsage'
import AdminSpinRewards from './modules/spinwheel/pages/admin/AdminSpinRewards'
import AdminGuestSpins from './modules/spinwheel/pages/admin/AdminGuestSpins'
import {
  faBoxOpen,
  faChartLine,
  faCrown,
  faDice,
  faGear,
  faGem,
  faReceipt,
  faShoppingBag,
  faTrophy,
  faUsers,
} from './lib/icons'

const adminLinks = [
  { to: '/admin', labelKey: 'dashboard', end: true, icon: faChartLine },
  { to: '/admin/customers', labelKey: 'customers', icon: faUsers },
  { to: '/admin/purchases', labelKey: 'purchases', icon: faBoxOpen },
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
  { to: '/admin/settings/general', labelKey: 'settings', icon: faGear },
]

const customerLinks = [
  { to: '/app', labelKey: 'membership', end: true, icon: faCrown },
  { to: '/app/spinwheel', labelKey: 'spinwheel', icon: faDice },
  { to: '/app/history', labelKey: 'purchaseHistory', icon: faReceipt },
  { to: '/app/points', labelKey: 'redemptionHistory', icon: faGem },
  { to: '/app/rewards', labelKey: 'rewardsCatalog', icon: faShoppingBag },
  { to: '/app/missions', labelKey: 'missions', icon: faTrophy },
  { to: '/app/reviews', labelKey: 'reviews', icon: faGem },
  { to: '/app/community', labelKey: 'communityHub', icon: faUsers },
]

export default function App() {
  return (
    <>
      <PwaInstallBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route element={<ProtectedRoute role="admin" />}>
          <Route element={<PanelLayout titleKey="adminPortal" links={adminLinks} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/purchases" element={<AdminPurchases />} />
            <Route path="/admin/spinwheel" element={<AdminSpinDashboard />} />
            <Route path="/admin/spinwheel/wheel" element={<AdminSpinWheel />} />
            <Route path="/admin/spinwheel/prizes/:id" element={<AdminSpinPrizes />} />
            <Route path="/admin/spinwheel/usage" element={<AdminSpinUsage />} />
            <Route path="/admin/spinwheel/rewards" element={<AdminSpinRewards />} />
            <Route path="/admin/spinwheel/guest-spins" element={<AdminGuestSpins />} />
            <Route path="/admin/settings" element={<Navigate to="/admin/settings/general" replace />} />
            <Route path="/admin/settings/:section" element={<Settings />} />
            <Route path="/admin/help" element={<HelpFeedback />} />
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
