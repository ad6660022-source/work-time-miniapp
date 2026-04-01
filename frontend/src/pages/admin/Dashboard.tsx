import { useEffect, useState, useCallback } from 'react'
import { Shield, Users, Play, Square } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'
import AttendanceBanner from '../../components/AttendanceBanner'
import type { ShiftOverview, Shift } from '../../types'

interface Props { userName: string }

export default function AdminDashboard({ userName }: Props) {
  const [overview, setOverview] = useState<ShiftOverview[]>([])
  const [currentTime, setCurrentTime] = useState('')
  const [checking, setChecking] = useState(false)
  const [activeCheck, setActiveCheck] = useState<any>(null)
  const [checkMsg, setCheckMsg] = useState('')
  const [shift, setShift] = useState<Shift | null | undefined>(undefined)
  const [elapsed, setElapsed] = useState('')
  const [shiftLoading, setShiftLoading] = useState(false)
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

  const loadShift = useCallback(async () => {
    try {
      const r = await api.shifts.today()
      setShift(r.shift)
    } catch {}
  }, [])

  useEffect(() => {
    load(); loadCheck(); loadShift()
    const t1 = setInterval(load, 60_000)
    const t2 = setInterval(loadCheck, 5_000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [load, loadCheck, loadShift])

  // Live timer for admin shift
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

  const doStartShift = async () => {
    if (shiftLoading) return
    setShiftLoading(true)
    try { const r = await api.shifts.start(); setShift(r.shift); haptic.success() }
    catch {} finally { setShiftLoading(false) }
  }

  const doEndShift = async () => {
    if (shiftLoading) return
    setShiftLoading(true)
    try { const r = await api.shifts.end(); setShift(r.shift); haptic.medium() }
    catch {} finally { setShiftLoading(false) }
  }

  const doCheck = async () => {
    if (checking) return
    setChecking(true); setCheckMsg('')
    try {
      await api.attendance.startCheck()
      await loadCheck()
      haptic.success()
      setCheckMsg('✅ Проверка запущена!')
    } catch (e: any) { setCheckMsg(e.message); haptic.error() }
    setChecking(false)
  }

  const isActive = shift?.status === 'active'
  const isClosed = shift?.status === 'closed'
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
          <div className="page-subtitle">
            Привет, {userName.split(' ')[0]} 👋
          </div>
        </div>
        <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 13 }}>
          {currentTime && `${currentTime}`}
        </div>
      </div>

      <AttendanceBanner />

      {/* ── Моя смена ── */}
      <div className="glass card slide-up" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 14 }}>
          МОЯ СМЕНА
        </div>

        {shift === undefined ? (
          <div className="loader" style={{ minHeight: 60 }}><div className="spinner" /></div>
        ) : isActive ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div className="dot dot-green" />
                <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600 }}>СМЕНА ИДЁТ</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }} className="shift-pulse">
                {elapsed || '00:00:00'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                начало в {shift.start_time}
              </div>
            </div>
            <button className="btn btn-red" onClick={doEndShift} disabled={shiftLoading}>
              <Square size={16} /> Завершить
            </button>
          </div>
        ) : isClosed ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Завершена</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {shift.start_time} — {shift.end_time}
              </div>
              {shift.duration_minutes && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {Math.floor(shift.duration_minutes / 60)}ч {shift.duration_minutes % 60}мин
                </div>
              )}
            </div>
            <button className="btn btn-green btn-sm" onClick={doStartShift} disabled={shiftLoading}>
              <Play size={14} /> Возобновить
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Смена ещё не начата
            </div>
            <button className="btn btn-green" onClick={doStartShift} disabled={shiftLoading}>
              <Play size={16} /> Начать
            </button>
          </div>
        )}
      </div>

      {/* ── Статистика команды ── */}
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

      {/* ── Проверка на месте ── */}
      <div className="glass card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 14 }}>
          📍 ПРОВЕРКА НА МЕСТЕ
        </div>

        {activeCheck ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--amber)' }}>
                ⏱ {String(Math.floor(countdown / 60)).padStart(2,'0')}:{String(countdown % 60).padStart(2,'0')} осталось
              </div>
              <span className="badge badge-assigned">Активна</span>
            </div>
            {activeCheck.responses.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {activeCheck.responses.map((r: any) => (
                  <span key={r.name} className="badge badge-done">✅ {r.name}</span>
                ))}
              </div>
            )}
            <button
              className="btn btn-red btn-full"
              style={{ marginTop: 4 }}
              onClick={async () => {
                try { await api.attendance.cancel(); await loadCheck(); haptic.error() } catch {}
              }}
            >
              Отменить проверку
            </button>
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

      {/* ── Список сотрудников ── */}
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
                  {s.status === 'active' && <span className="badge badge-active">с {s.start_time}</span>}
                  {s.status === 'closed' && <span className="badge badge-closed">{s.start_time}–{s.end_time}</span>}
                  {!s.status && <span className="badge badge-absent">нет</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
