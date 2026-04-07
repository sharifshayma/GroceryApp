import { Routes, Route } from 'react-router-dom'
import { useDirection } from './hooks/useDirection'
import ProtectedRoute from './components/ProtectedRoute'
import HouseholdGuard from './components/HouseholdGuard'
import AppLayout from './components/AppLayout'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import ForgotPassword from './pages/ForgotPassword'
import HouseholdSetup from './pages/HouseholdSetup'
import JoinHousehold from './pages/JoinHousehold'
import Home from './pages/Home'
import Category from './pages/Category'
import Lists from './pages/Lists'
import Stock from './pages/Stock'
import Profile from './pages/Profile'
import ManageCategories from './pages/ManageCategories'
import ManageTags from './pages/ManageTags'
import CreateList from './pages/CreateList'
import EditList from './pages/EditList'
// import IconPreview from './pages/IconPreview'

export default function App() {
  useDirection()

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected routes (auth required) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/household-setup" element={<HouseholdSetup />} />
        <Route path="/join/:inviteCode" element={<JoinHousehold />} />

        {/* Household required + tab bar layout */}
        <Route element={<HouseholdGuard />}>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="/category/:categoryId" element={<Category />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/lists/:listId" element={<Lists />} />
            <Route path="/create-list" element={<CreateList />} />
            <Route path="/edit-list/:listId" element={<EditList />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/manage-categories" element={<ManageCategories />} />
            <Route path="/manage-tags" element={<ManageTags />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
