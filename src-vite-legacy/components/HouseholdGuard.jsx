import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from './LoadingSpinner'

export default function HouseholdGuard() {
  const { profile, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!profile?.household_id) {
    return <Navigate to="/household-setup" replace />
  }

  return <Outlet />
}
