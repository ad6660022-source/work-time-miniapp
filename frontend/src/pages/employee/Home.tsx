import { useEffect, useState, useCallback } from 'react'
import { Play, Square, Clock, CheckCircle } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'
import type { Shift } from '../../types'

interface Props { userName: string }

export default function EmployeeHome({ userName }: Props) {
  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  const [elapsed, setElapsed] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { haptic } = useTelegram()

  const load = useCallback(async () => {
    const r = await api.shifts.today()
    setShift(r.shift)
  }, [])

  useEffect(() => { load() }, [load])

  // Live clock for active shift
  useEffect(() => {
    if (!shift || shift.status !== 'active' || !shift.start_time) return
    const tick = () => {
      const [h, m] = shift.start_time!.split(':').map(Number)
      const now = new Date()
      const start = new Date()
      start.setHours(h, m, 0, 0)
      const diff = Math.max(0, now.getTime() - start.getTime())
      const hours = Math.floor(diff / 3_600_000)
      const mins  = Math.floor((diff % 3_600_000) / 60_000)
      const secs  = Math.floor((diff % 60_000) / 1000)
      setElapsed(`${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [shift])

  const doStart = async () => {
    if (loading) return
    setLoading(true); setError('')
    try {
      const r = await api.shifts.start()
      setShift(r.shift)
      haptic.success()
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const doEnd = async () => {
    if (loading) return
    setLoading(true); setError('')
    try {
      const r = await api.shifts.end()
      setShift(r.shift)
      haptic.medium()
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const isActive = shift?.status === 'active'
  const isClosed = shift?.status === 'closed'

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Привет, {userName.split(' ')[0]} 👋</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Shift card */}
      <div className="glass card shift-display slide-up">
        {shift === undefined ? (
          <div className="loader"><div className="spinner" /></div>
        ) : isActive ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <div className="dot dot-green" />
              <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>СМЕНА ИДЁТ</span>
            </div>
            <div className="shift-time shift-pulse">{elapsed || '00:00:00'}</div>
            <div className="shift-label">начало в {shift.start_time}</div>
          </>
        ) : isClosed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <CheckCircle size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>СМЕНА ЗАВЕРШЕНА</span>
            </div>
            <div className="shift-time" style={{ fontSize: 32, color: 'var(--text-secondary)' }}>
              {shift.start_time} — {shift.end_time}
            </div>
            {shift.duration_minutes && (
              <div className="shift-label">
                {Math.floor(shift.duration_minutes / 60)}ч {shift.duration_minutes % 60}мин
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <Clock size={16} color="var(--text-muted)" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>СМЕНА НЕ НАЧАТА</span>
            </div>
            <div className="shift-time" style={{ color: 'var(--text-muted)' }}>--:--:--</div>
            <div className="shift-label">рабочий день с 9:00</div>
          </>
        )}

        <div style={{ height: 24 }} />

        {isActive ? (
          <button className="btn btn-red btn-full" onClick={doEnd} disabled={loading}>
            <Square size={18} /> Завершить смену
          </button>
        ) : (
          <button className="btn btn-green btn-full" onClick={doStart} disabled={loading}>
            <Play size={18} /> {isClosed ? 'Возобновить смену' : 'Начать смену'}
          </button>
        )}
      </div>

      {/* Quick stats */}
      <QuickStats />
    </div>
  )
}

function QuickStats() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    // get my own stats via users endpoint — reuse progress
    import('../../api').then(({ api }) => {
      api.auth.me().then(r => {
        if (r.user) {
          api.users.stats(r.user.id).then(s => setStats(s.stats)).catch(() => {})
        }
      })
    })
  }, [])

  if (!stats) return null

  return (
    <>
      <div className="section-label">Задачи сегодня</div>
      <div className="stats-grid">
        <div className="glass-sm stat-card">
          <div className="stat-value stat-amber">{stats.assigned}</div>
          <div className="stat-label">Ожидают</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-blue">{stats.in_progress}</div>
          <div className="stat-label">В работе</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-green">{stats.done}</div>
          <div className="stat-label">Выполнено</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-red">{stats.late_count}</div>
          <div className="stat-label">Опозданий</div>
        </div>
      </div>
    </>
  )
}
