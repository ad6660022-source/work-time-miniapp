import { useEffect, useState, useCallback } from 'react'
import { Play, Square, Clock, CheckCircle, Coffee, UtensilsCrossed } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'
import AttendanceBanner from '../../components/AttendanceBanner'
import type { Shift } from '../../types'

interface Props { userName: string }

export default function EmployeeHome({ userName }: Props) {
  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  const [elapsed, setElapsed] = useState('')
  const [breakElapsed, setBreakElapsed] = useState('')
  const [loading, setLoading] = useState(false)
  const [breakLoading, setBreakLoading] = useState(false)
  const [error, setError] = useState('')
  const { haptic } = useTelegram()

  const load = useCallback(async () => {
    const r = await api.shifts.today()
    setShift(r.shift)
  }, [])

  useEffect(() => { load() }, [load])

  // Таймер смены
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

  // Таймер перерыва
  useEffect(() => {
    if (!shift?.active_break) { setBreakElapsed(''); return }
    const startTs = new Date(shift.active_break.start_time).getTime()
    const tick = () => {
      const diff = Math.max(0, Date.now() - startTs)
      const mins = Math.floor(diff / 60_000)
      const secs = Math.floor((diff % 60_000) / 1000)
      setBreakElapsed(`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [shift?.active_break])

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

  const doBreakStart = async (type: 'lunch' | 'break') => {
    if (breakLoading) return
    setBreakLoading(true)
    try {
      await api.shifts.breakStart(type)
      await load()
      haptic.medium()
    } catch (e: any) { setError(e.message) }
    setBreakLoading(false)
  }

  const doBreakEnd = async () => {
    if (breakLoading) return
    setBreakLoading(true)
    try {
      await api.shifts.breakEnd()
      await load()
      haptic.success()
    } catch (e: any) { setError(e.message) }
    setBreakLoading(false)
  }

  const isActive = shift?.status === 'active'
  const isClosed = shift?.status === 'closed'
  const onBreak = !!shift?.active_break

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Привет, {userName.split(' ')[0]} 👋</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <AttendanceBanner />

      {/* Карточка смены */}
      <div className="glass card shift-display slide-up">
        {shift === undefined ? (
          <div className="loader"><div className="spinner" /></div>
        ) : isActive ? (
          <>
            {onBreak ? (
              /* ── На перерыве ── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  <div className="dot" style={{ background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)' }} />
                  <span style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>
                    {shift.active_break!.type === 'lunch' ? 'ОБЕД' : 'ОТОШЁЛ'}
                  </span>
                </div>
                <div className="shift-time shift-pulse" style={{ color: 'var(--amber)' }}>
                  {breakElapsed || '00:00'}
                </div>
                <div className="shift-label">смена: {elapsed || '00:00:00'}</div>
                <div style={{ height: 24 }} />
                <button
                  className="btn btn-green btn-full"
                  onClick={doBreakEnd}
                  disabled={breakLoading}
                >
                  ✅ Я вернулся
                </button>
              </>
            ) : (
              /* ── Смена идёт ── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  <div className="dot dot-green" />
                  <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>СМЕНА ИДЁТ</span>
                </div>
                <div className="shift-time shift-pulse">{elapsed || '00:00:00'}</div>
                <div className="shift-label">начало в {shift.start_time}</div>
                <div style={{ height: 20 }} />

                {/* Кнопки перерыва */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    className="btn btn-glass"
                    style={{ flex: 1, fontSize: 13 }}
                    onClick={() => doBreakStart('lunch')}
                    disabled={breakLoading}
                  >
                    <UtensilsCrossed size={15} /> Обед
                  </button>
                  <button
                    className="btn btn-glass"
                    style={{ flex: 1, fontSize: 13 }}
                    onClick={() => doBreakStart('break')}
                    disabled={breakLoading}
                  >
                    <Coffee size={15} /> Отошёл
                  </button>
                </div>

                <button className="btn btn-red btn-full" onClick={doEnd} disabled={loading}>
                  <Square size={18} /> Завершить смену
                </button>
              </>
            )}
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
            <div style={{ height: 24 }} />
            <button className="btn btn-green btn-full" onClick={doStart} disabled={loading}>
              <Play size={18} /> Возобновить смену
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <Clock size={16} color="var(--text-muted)" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>СМЕНА НЕ НАЧАТА</span>
            </div>
            <div className="shift-time" style={{ color: 'var(--text-muted)' }}>--:--:--</div>
            <div className="shift-label">рабочий день с 9:00</div>
            <div style={{ height: 24 }} />
            <button className="btn btn-green btn-full" onClick={doStart} disabled={loading}>
              <Play size={18} /> Начать смену
            </button>
          </>
        )}
      </div>

      <QuickStats />
    </div>
  )
}

function QuickStats() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    import('../../api').then(({ api }) => {
      api.auth.me().then(r => {
        if (r.user) {
          api.users.stats(r.user.id).then(s => setStats(s.stats)).catch(() => {})
        }
      })
    })
  }, [])

  if (!stats) return null

  const totalHours = Math.floor((stats.total_work_minutes || 0) / 60)
  const totalMins  = (stats.total_work_minutes || 0) % 60

  return (
    <>
      <div className="section-label">Моя статистика</div>
      <div className="stats-grid">
        <div className="glass-sm stat-card">
          <div className="stat-value stat-green">{stats.done}</div>
          <div className="stat-label">Выполнено</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-blue">{stats.in_progress}</div>
          <div className="stat-label">В работе</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-amber">{stats.assigned}</div>
          <div className="stat-label">Ожидают</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-red">{stats.late_count}</div>
          <div className="stat-label">Опоздания</div>
        </div>
      </div>
      <div className="stats-grid" style={{ marginTop: 8 }}>
        <div className="glass-sm stat-card" style={{ gridColumn: 'span 2' }}>
          <div className="stat-value stat-purple">{totalHours}ч {totalMins}м</div>
          <div className="stat-label">Отработано всего</div>
        </div>
        <div className="glass-sm stat-card" style={{ gridColumn: 'span 2' }}>
          <div className="stat-value stat-amber">
            {stats.avg_rating != null ? `${stats.avg_rating} ★` : '—'}
          </div>
          <div className="stat-label">Средняя оценка</div>
        </div>
      </div>
    </>
  )
}
