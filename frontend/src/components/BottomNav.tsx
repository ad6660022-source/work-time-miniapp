import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CheckSquare, BarChart2, FileText, Bell, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api'

interface Props {
  isAdmin: boolean
}

export default function BottomNav({ isAdmin }: Props) {
  const loc = useLocation()
  const nav = useNavigate()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    api.attendance.notifications().then(r => setUnread(r.unread_count)).catch(() => {})
    const t = setInterval(() => {
      api.attendance.notifications().then(r => setUnread(r.unread_count)).catch(() => {})
    }, 30_000)
    return () => clearInterval(t)
  }, [])

  const employeeTabs = [
    { path: '/',           icon: Home,        label: 'Главная' },
    { path: '/tasks',      icon: CheckSquare, label: 'Задачи' },
    { path: '/progress',   icon: BarChart2,   label: 'Прогресс' },
    { path: '/report',     icon: FileText,    label: 'Отчёт' },
    { path: '/notifs',     icon: Bell,        label: 'Уведомления', badge: unread },
  ]

  const adminTabs = [
    { path: '/admin',           icon: Home,        label: 'Дашборд' },
    { path: '/admin/employees', icon: Users,       label: 'Команда' },
    { path: '/admin/tasks',     icon: CheckSquare, label: 'Задачи' },
    { path: '/admin/reports',   icon: FileText,    label: 'Отчёты' },
    { path: '/notifs',          icon: Bell,        label: 'Уведомления', badge: unread },
  ]

  const tabs = isAdmin ? adminTabs : employeeTabs

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => {
        const active = loc.pathname === tab.path || (tab.path !== '/' && tab.path !== '/admin' && loc.pathname.startsWith(tab.path))
        const Icon = tab.icon
        return (
          <div
            key={tab.path}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => nav(tab.path)}
          >
            <div className="nav-icon">
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            </div>
            {tab.badge && tab.badge > 0 ? (
              <div className="nav-badge">{tab.badge > 9 ? '9+' : tab.badge}</div>
            ) : null}
            <span>{tab.label}</span>
          </div>
        )
      })}
    </nav>
  )
}
