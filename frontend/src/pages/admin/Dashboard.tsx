import { useEffect, useState, useCallback } from 'react'
import { Shield, Users, Clock, AlertCircle } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'
import type { ShiftOverview } from '../../types'

interface Props { userName: string }

export default function AdminDashboard({ userName }: Props) {
  const [overview, setOverview] = useState<ShiftOverview[]>([])
  const [currentTime, setCurrentTime] = useState('')
  const [checking, setChecking] = useState(false)
  const [activeCheck, setActiveCheck] = useState<any>(null)
  const [checkMsg, setCheckMsg] = useState('')
  const { haptic } = useTelegram()

  const load = useCallback(async () => {
    try {
      const r = await api.shifts.overview()
      setOverview(r.overview)
      setCurrentTime(r.time)
    } catch {}
  }, [])

  const loadCheck = useCallback(async () => {
    try {
      const r = await api.attendance.active()
      setActiveCheck(r.check)
    } catch {}
  }, [])

  useEffect(() => {
    load(); loadCheck()
    const t1 = setInterval(load, 60_000)
    const t2 = setInterval(loadCheck, 5_000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [load, loadCheck])

  // Countdown for active check
  const [countdown, setCountdown] = useState(0)
  useEffect(() => {
    if (!activeCheck) return
    setCountdown(activeCheck.seconds_left)
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { loadCheck(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [activeCheck, loadCheck])

  const doCheck = async () => {
    if (checking) return
    setChecking(true); setCheckMsg('')
    try {
      await api.attendance.startCheck()
      await loadCheck()
      haptic.success()
      setCheckMsg('✅ Проверка запущена! Ждите 5 минут.')
    } catch (e: any) {
      setCheckMsg(e.message)
      haptic.error()
    }
    setChecking(false)
  }

  const on = overview.filter(s => s.status === 'active')
  const off = overview.filter(s => s.status === 'closed')
  const absent = overview.filter(s => !s.status)

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} color="var(--accent-2)" />
            <div className="page-title" style={{ fontSize: 22 }}>Дашборд</div>
          </div>
          <div className="page-subtitle">{currentTime && `Обновлено в ${currentTime}`}</div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-green">{on.length}</div>
          <div className="stat-label">На смене</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-purple">{off.length}</div>
          <div className="stat-label">Завершили</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-red">{absent.length}</div>
          <div className="stat-label">Отсутствуют</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-blue">{overview.length}</div>
          <div className="stat-label">Всего</div>
        </div>
      </div>

      {/* Attendance check */}
      <div className="glass card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 14 }}>
          📍 ПРОВЕРКА НА МЕСТЕ
        </div>

        {activeCheck ? (
          <>
            <div className="countdown">{String(Math.floor(countdown / 60)).padStart(2,'0')}:{String(countdown % 60).padStart(2,'0')}</div>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, margin: '8px 0 16px' }}>
              Ожидаем ответов…
            </div>
            {activeCheck.responses.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {activeCheck.responses.map((r: any) => (
                  <span key={r.name} className="badge badge-done">✅ {r.name}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {checkMsg && (
              <div className={`alert ${checkMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12 }}>
                {checkMsg}
              </div>
            )}
            <button className="btn btn-primary btn-full" onClick={doCheck} disabled={checking}>
              <Users size={18} /> Запустить проверку
            </button>
          </>
        )}
      </div>

      {/* Employees list */}
      {overview.length > 0 && (
        <>
          <div className="section-label">Сотрудники сегодня</div>
          <div className="glass" style={{ overflow: 'hidden' }}>
            {overview.map(s => (
              <div key={s.id} className="list-item" style={{ cursor: 'default' }}>
                <div className={`dot ${s.status === 'active' ? 'dot-green' : s.status === 'closed' ? 'dot-gray' : 'dot-red'}`} />
                <div className="list-item-content">
                  <div className="list-item-title">{s.name}</div>
                  <div className="list-item-subtitle">{s.position || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {s.status === 'active' && (
                    <span className="badge badge-active">с {s.start_time}</span>
                  )}
                  {s.status === 'closed' && (
                    <span className="badge badge-closed">{s.start_time}–{s.end_time}</span>
                  )}
                  {!s.status && (
                    <span className="badge badge-absent">нет</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
