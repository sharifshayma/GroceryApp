import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

export default function AppLayout() {
  return (
    <div className="min-h-dvh bg-bg">
      <main className="pb-24">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
