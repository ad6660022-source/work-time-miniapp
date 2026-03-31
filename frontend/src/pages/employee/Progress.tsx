import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Stats } from '../../types'

export default function Progress() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [myId, setMyId] = useState<number | null>(null)

  useEffect(() => {
    api.auth.me().then(r => {
      if (r.user) {
        setMyId(r.user.id)
        api.users.stats(r.user.id).then(s => setStats(s.stats)).catch(() => {})
      }
    })
  }, [])

  if (!stats) return <div className="loader"><div className="spinner" /></div>

  const total = stats.assigned + stats.in_progress + stats.done
  const donePct = total ? Math.round(stats.done / total * 100) : 0

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Прогресс</div>
          <div className="page-subtitle">Мои показатели</div>
        </div>
      </div>

      {/* Task overview */}
      <div className="glass card slide-up" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 16 }}>ЗАДАЧИ</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--amber)' }}>{stats.assigned}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ожидают</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--blue)' }}>{stats.in_progress}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>В работе</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--green)' }}>{stats.done}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Готово</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Выполнено</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{donePct}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${donePct}%` }} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="glass-sm stat-card">
          <div className="stat-value stat-purple">{stats.shifts_month}</div>
          <div className="stat-label">Смен в этом месяце</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-red">{stats.late_count}</div>
          <div className="stat-label">Опоздания</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-green">{total}</div>
          <div className="stat-label">Всего задач</div>
        </div>
        <div className="glass-sm stat-card">
          <div className="stat-value stat-blue">{donePct}%</div>
          <div className="stat-label">Эффективность</div>
        </div>
      </div>
    </div>
  )
}
