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
import CustomerProfile from './pages/customer/Profile'
import Settings from './pages/Settings'
import {
  faChartLine,
  faCrown,
  faGear,
  faReceipt,
  faUser,
  faUsers,
  faBoxOpen,
} from './lib/icons'

const adminLinks = [
  { to: '/admin', labelKey: 'dashboard', end: true, icon: faChartLine },
  { to: '/admin/customers', labelKey: 'customers', icon: faUsers },
  { to: '/admin/purchases', labelKey: 'purchases', icon: faBoxOpen },
  {
    to: '/admin/settings',
    labelKey: 'settings',
    icon: faGear,
    children: [
      { to: '/admin/settings/general', labelKey: 'general', icon: faGear },
      { to: '/admin/settings/profile', labelKey: 'profile', icon: faUser },
    ],
  },
]

const customerLinks = [
  { to: '/app', labelKey: 'membership', end: true, icon: faCrown },
  { to: '/app/history', labelKey: 'purchaseHistory', icon: faReceipt },
  { to: '/app/profile', labelKey: 'profile', icon: faUser },
  {
    to: '/app/settings',
    labelKey: 'settings',
    icon: faGear,
    children: [
      { to: '/app/settings/general', labelKey: 'general', icon: faGear },
      { to: '/app/settings/profile', labelKey: 'profile', icon: faUser },
    ],
  },
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
            <Route path="/admin/settings" element={<Navigate to="/admin/settings/general" replace />} />
            <Route path="/admin/settings/:section" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="customer" />}>
          <Route element={<PanelLayout titleKey="memberApp" links={customerLinks} />}>
            <Route path="/app" element={<CustomerMembership />} />
            <Route path="/app/history" element={<CustomerHistory />} />
            <Route path="/app/profile" element={<CustomerProfile />} />
            <Route path="/app/settings" element={<Navigate to="/app/settings/general" replace />} />
            <Route path="/app/settings/:section" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
