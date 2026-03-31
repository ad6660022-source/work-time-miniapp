import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Crown, Lock, Unlock, Calendar } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'
import type { User, Stats } from '../../types'

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { haptic } = useTelegram()
  const uid = Number(id)

  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [sched, setSched] = useState<{ work_days: number[]; shift_start: string; shift_end: string } | null>(null)
  const [position, setPosition] = useState('')
  const [editPos, setEditPos] = useState(false)
  const [editSched, setEditSched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [approvePos, setApprovePos] = useState('')
  const [showApprove, setShowApprove] = useState(false)
  const [localWorkDays, setLocalWorkDays] = useState<number[]>([])
  const [shiftStart, setShiftStart] = useState('09:00')
  const [shiftEnd, setShiftEnd] = useState('19:00')

  useEffect(() => {
    const u = api.users.all().then(r => r.users.find(x => x.id === uid))
    Promise.all([
      api.users.all(),
      api.users.stats(uid),
      api.users.schedule(uid),
    ]).then(([r, s, sc]) => {
      const found = r.users.find(x => x.id === uid)
      if (!found) { nav('/admin/employees'); return }
      setUser(found)
      setPosition(found.position || '')
      setStats(s.stats)
      if (sc.schedule) {
        setSched(sc.schedule)
        setLocalWorkDays([...sc.schedule.work_days])
        setShiftStart(sc.schedule.shift_start)
        setShiftEnd(sc.schedule.shift_end)
      }
    }).catch(() => nav('/admin/employees'))
  }, [uid])

  if (!user) return <div className="loader"><div className="spinner" /></div>

  const savePosition = async () => {
    setLoading(true)
    await api.users.update(uid, { position })
    setUser(prev => prev ? { ...prev, position } : prev)
    setEditPos(false); setMsg('Должность обновлена')
    haptic.success(); setLoading(false)
  }

  const approveUser = async () => {
    if (!approvePos.trim()) return
    setLoading(true)
    await api.users.approve(uid, approvePos)
    setUser(prev => prev ? { ...prev, is_approved: true, position: approvePos } : prev)
    setShowApprove(false); setMsg('Сотрудник одобрен!')
    haptic.success(); setLoading(false)
  }

  const toggleAdmin = async () => {
    const newVal = !user.is_admin
    await api.users.update(uid, { is_admin: newVal })
    setUser(prev => prev ? { ...prev, is_admin: newVal } : prev)
    haptic.medium()
  }

  const toggleBlock = async () => {
    const newVal = !user.is_blocked
    await api.users.update(uid, { is_blocked: newVal })
    setUser(prev => prev ? { ...prev, is_blocked: newVal } : prev)
    haptic.medium()
  }

  const saveSched = async () => {
    setLoading(true)
    await api.users.updateSchedule(uid, { work_days: localWorkDays, shift_start: shiftStart, shift_end: shiftEnd })
    setSched({ work_days: localWorkDays, shift_start: shiftStart, shift_end: shiftEnd })
    setEditSched(false); setMsg('График сохранён')
    haptic.success(); setLoading(false)
  }

  const toggleDay = (d: number) => {
    setLocalWorkDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  const total = stats ? stats.assigned + stats.in_progress + stats.done : 0
  const donePct = total && stats ? Math.round(stats.done / total * 100) : 0

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-glass btn-sm" onClick={() => nav('/admin/employees')} style={{ padding: '10px' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div className="page-title" style={{ fontSize: 20 }}>{user.name}</div>
          <div className="page-subtitle">{user.position || 'Без должности'}</div>
        </div>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{msg}</div>}

      {/* Approve pending */}
      {!user.is_approved && (
        <div className="glass card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, marginBottom: 12 }}>🆕 ОЖИДАЕТ ОДОБРЕНИЯ</div>
          {showApprove ? (
            <>
              <div className="input-wrap">
                <label className="input-label">Должность</label>
                <input className="input" placeholder="Введите должность" value={approvePos} onChange={e => setApprovePos(e.target.value)} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-glass" style={{ flex: 1 }} onClick={() => setShowApprove(false)}>Отмена</button>
                <button className="btn btn-green" style={{ flex: 2 }} onClick={approveUser} disabled={loading}>✅ Одобрить</button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-green btn-full" onClick={() => setShowApprove(true)}>✅ Одобрить</button>
              <button className="btn btn-red" onClick={toggleBlock}><Lock size={16} /></button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {user.is_approved && (
        <div className="glass" style={{ overflow: 'hidden', marginBottom: 12 }}>
          {/* Edit position */}
          <div className="list-item" onClick={() => setEditPos(!editPos)}>
            <div className="list-item-content">
              <div className="list-item-title">Должность</div>
              <div className="list-item-subtitle">{user.position || 'Не задана'}</div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--accent-2)' }}>Изменить</span>
          </div>

          {editPos && (
            <div style={{ padding: '0 20px 16px' }}>
              <input className="input" value={position} onChange={e => setPosition(e.target.value)} placeholder="Должность" autoFocus />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="btn btn-glass" style={{ flex: 1 }} onClick={() => setEditPos(false)}>Отмена</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={savePosition} disabled={loading}>Сохранить</button>
              </div>
            </div>
          )}

          <div className="list-item" onClick={toggleAdmin}>
            <div className="list-item-content">
              <div className="list-item-title">{user.is_admin ? 'Снять права admin' : 'Дать права admin'}</div>
            </div>
            <Crown size={18} color={user.is_admin ? 'var(--accent-2)' : 'var(--text-muted)'} />
          </div>

          <div className="list-item" onClick={toggleBlock}>
            <div className="list-item-content">
              <div className="list-item-title" style={{ color: user.is_blocked ? 'var(--green)' : 'var(--red)' }}>
                {user.is_blocked ? 'Разблокировать' : 'Заблокировать'}
              </div>
            </div>
            {user.is_blocked ? <Unlock size={18} color="var(--green)" /> : <Lock size={18} color="var(--red)" />}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <>
          <div className="section-label">Статистика</div>
          <div className="glass card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              {[
                { v: stats.assigned,   l: 'Назначено',  c: 'var(--amber)' },
                { v: stats.in_progress,l: 'В работе',   c: 'var(--blue)' },
                { v: stats.done,       l: 'Готово',     c: 'var(--green)' },
              ].map(x => (
                <div key={x.l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: x.c }}>{x.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{x.l}</div>
                </div>
              ))}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${donePct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>Опоздания: {stats.late_count}</span>
              <span>Смен/мес: {stats.shifts_month}</span>
            </div>
          </div>
        </>
      )}

      {/* Schedule */}
      {sched && (
        <>
          <div className="section-label">График работы</div>
          <div className="glass card">
            {editSched ? (
              <>
                <div className="input-wrap">
                  <label className="input-label">Рабочие дни</label>
                  <div className="day-grid">
                    {DAYS.map((d, i) => (
                      <button key={d} className={`day-btn ${localWorkDays.includes(i) ? 'active' : ''}`} onClick={() => toggleDay(i)}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="input-wrap" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="input-label">Начало</label>
                    <input className="input" value={shiftStart} onChange={e => setShiftStart(e.target.value)} placeholder="09:00" />
                  </div>
                  <div className="input-wrap" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="input-label">Конец</label>
                    <input className="input" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} placeholder="19:00" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn btn-glass" style={{ flex: 1 }} onClick={() => setEditSched(false)}>Отмена</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveSched} disabled={loading}>💾 Сохранить</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  {DAYS.map((d, i) => (
                    <span key={d} className={`badge ${sched.work_days.includes(i) ? 'badge-done' : 'badge-closed'}`}>{d}</span>
                  ))}
                </div>
                <div style={{ fontSize: 15, marginBottom: 14 }}>
                  <Calendar size={14} style={{ display: 'inline', marginRight: 6 }} />
                  {sched.shift_start} — {sched.shift_end}
                </div>
                <button className="btn btn-glass btn-full" onClick={() => setEditSched(true)}>✏️ Изменить график</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
