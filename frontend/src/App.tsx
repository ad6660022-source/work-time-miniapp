import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { api, setInitData } from './api'
import { useTelegram } from './hooks/useTelegram'
import type { User } from './types'

import BottomNav from './components/BottomNav'
import Register from './pages/Register'
import Pending from './pages/Pending'
import Notifications from './pages/Notifications'

// Employee pages
import EmployeeHome from './pages/employee/Home'
import Tasks from './pages/employee/Tasks'
import TaskDetailPage from './pages/employee/TaskDetail'
import Progress from './pages/employee/Progress'
import Report from './pages/employee/Report'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import Employees from './pages/admin/Employees'
import EmployeeDetail from './pages/admin/EmployeeDetail'
import AdminTasks from './pages/admin/AdminTasks'
import AdminTaskDetail from './pages/admin/AdminTaskDetail'
import { ReportsList, ReportsByDate } from './pages/admin/Reports'
import Settings from './pages/admin/Settings'

type AppState = 'loading' | 'register' | 'pending' | 'blocked' | 'ready'

export default function App() {
  const { tg, initData, user: tgUser } = useTelegram()
  const [appState, setAppState] = useState<AppState>('loading')
  const [dbUser, setDbUser] = useState<User | null>(null)

  const checkAuth = useCallback(async () => {
    setInitData(initData)
    try {
      const r = await api.auth.me()
      if (r.status === 'not_registered') {
        setAppState('register')
        return
      }
      const u = r.user!
      if (u.is_blocked) { setAppState('blocked'); return }
      if (!u.is_approved) { setAppState('pending'); return }
      setDbUser(u)
      setAppState('ready')
    } catch {
      // In dev without real initData — still show app
      if (import.meta.env.DEV) {
        setAppState('register')
      } else {
        setAppState('loading')
      }
    }
  }, [initData])

  useEffect(() => {
    tg?.ready()
    tg?.expand()
    checkAuth()
  }, [])

  const handleRegistered = () => {
    checkAuth()
  }

  if (appState === 'loading') {
    return (
      <div className="loader" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Загрузка…</div>
        </div>
      </div>
    )
  }

  if (appState === 'register') {
    return <Register onRegistered={handleRegistered} tgFirstName={tgUser?.first_name} />
  }

  if (appState === 'pending') {
    return <Pending />
  }

  if (appState === 'blocked') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Аккаунт заблокирован</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Обратитесь к администратору</p>
        </div>
      </div>
    )
  }

  const isAdmin = dbUser?.is_admin ?? false
  const userName = dbUser?.name ?? ''

  return (
    <div className="app">
      <Routes>
        {isAdmin ? (
          <>
            <Route path="/admin"             element={<AdminDashboard userName={userName} />} />
            <Route path="/admin/employees"   element={<Employees />} />
            <Route path="/admin/employees/:id" element={<EmployeeDetail />} />
            <Route path="/admin/tasks"       element={<AdminTasks />} />
            <Route path="/admin/tasks/:id"   element={<AdminTaskDetail />} />
            <Route path="/admin/reports"     element={<ReportsList />} />
            <Route path="/admin/reports/:date" element={<ReportsByDate />} />
            <Route path="/admin/settings"    element={<Settings />} />
            <Route path="/notifs"            element={<Notifications />} />
            <Route path="*"                  element={<Navigate to="/admin" replace />} />
          </>
        ) : (
          <>
            <Route path="/"           element={<EmployeeHome userName={userName} />} />
            <Route path="/tasks"      element={<Tasks />} />
            <Route path="/tasks/:id"  element={<TaskDetailPage />} />
            <Route path="/progress"   element={<Progress />} />
            <Route path="/report"     element={<Report />} />
            <Route path="/notifs"     element={<Notifications />} />
            <Route path="*"           element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      <BottomNav isAdmin={isAdmin} />
    </div>
  )
}
