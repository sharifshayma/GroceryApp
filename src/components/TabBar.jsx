import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStock } from '../hooks/useStock'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'
import { IconHomeFilled, IconHome, IconListsFilled, IconLists, IconStockFilled, IconStock, IconProfileFilled, IconProfile } from './Icons'

const tabs = [
  {
    path: '/',
    labelKey: 'nav.home',
    icon: (active) => active ? <IconHomeFilled /> : <IconHome />,
  },
  {
    path: '/lists',
    labelKey: 'nav.lists',
    icon: (active) => active ? <IconListsFilled /> : <IconLists />,
  },
  {
    path: '/stock',
    labelKey: 'nav.stock',
    icon: (active) => active ? <IconStockFilled /> : <IconStock />,
  },
  {
    path: '/profile',
    labelKey: 'nav.profile',
    icon: (active) => active ? <IconProfileFilled /> : <IconProfile />,
  },
]

export default function TabBar() {
  const location = useLocation()
  const { t } = useTranslation()
  const { lowStockCount } = useStock()
  const isKeyboardVisible = useKeyboardVisible()

  if (isKeyboardVisible) return null

  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-surface border-t border-neutral z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/category')
              : location.pathname.startsWith(tab.path)

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              <div className="relative">
                {tab.icon(isActive)}
                {tab.path === '/stock' && lowStockCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">
                    {lowStockCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold">{t(tab.labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
