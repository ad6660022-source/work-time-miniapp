import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Crown, Lock, Clock } from 'lucide-react'
import { api } from '../../api'
import type { User } from '../../types'

export default function Employees() {
  const [users, setUsers] = useState<User[]>([])
  const [pending, setPending] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    Promise.all([api.users.all(), api.users.pending()])
      .then(([u, p]) => { setUsers(u.users); setPending(p.pending) })
      .finally(() => setLoading(false))
  }, [])

  const approved = users.filter(u => u.is_approved)

  if (loading) return <div className="loader"><div className="spinner" /></div>

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Команда</div>
          <div className="page-subtitle">{approved.length} сотрудников</div>
        </div>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <>
          <div className="section-label">Ожидают одобрения — {pending.length}</div>
          <div className="glass" style={{ overflow: 'hidden', marginBottom: 16 }}>
            {pending.map(u => (
              <div key={u.id} className="list-item" onClick={() => nav(`/admin/employees/${u.id}`)}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(251,191,36,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={16} color="var(--amber)" />
                </div>
                <div className="list-item-content">
                  <div className="list-item-title">{u.name}</div>
                  <div className="list-item-subtitle">@{u.username || '—'}</div>
                </div>
                <span className="badge badge-assigned">Новый</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Employees */}
      <div className="section-label">Все сотрудники</div>
      <div className="glass" style={{ overflow: 'hidden' }}>
        {approved.map(u => (
          <div key={u.id} className="list-item" onClick={() => nav(`/admin/employees/${u.id}`)}>
            <div style={{
              width: 36, height: 36, borderRadius: 12, flexShrink: 0,
              background: u.is_admin ? 'rgba(124,111,247,0.2)' : 'rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {u.is_admin ? <Crown size={16} color="var(--accent-2)" /> : (
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {u.name[0]}
                </span>
              )}
            </div>
            <div className="list-item-content">
              <div className="list-item-title">
                {u.name} {u.is_blocked && <Lock size={12} color="var(--red)" style={{ display: 'inline', marginLeft: 4 }} />}
              </div>
              <div className="list-item-subtitle">{u.position || 'Без должности'}</div>
            </div>
            <ChevronRight size={16} className="list-item-right" />
          </div>
        ))}
      </div>
    </div>
  )
}
