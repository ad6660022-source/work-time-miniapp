import { useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { api } from '../api'
import type { Notification } from '../types'

const TYPE_ICON: Record<string, string> = {
  task:       '📌',
  task_done:  '✅',
  shift:      '⏰',
  report:     '📝',
  attendance: '📍',
  late:       '🔴',
  approval:   '🎉',
  info:       '💬',
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000)  return 'только что'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`
  if (diff < 86_400_000) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function Notifications() {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const r = await api.attendance.notifications()
      setNotifs(r.notifications)
    } catch {} finally { setLoading(false) }
  }

  const markRead = async () => {
    await api.attendance.markRead()
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  useEffect(() => {
    load()
    api.attendance.markRead().catch(() => {})
  }, [])

  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Уведомления</div>
          {unread > 0 && <div className="page-subtitle">{unread} непрочитанных</div>}
        </div>
        {unread > 0 && (
          <button className="btn btn-glass btn-sm" onClick={markRead}>
            <CheckCheck size={16} /> Прочитать все
          </button>
        )}
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : notifs.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <div className="empty-text">Уведомлений нет</div>
        </div>
      ) : (
        <div className="glass" style={{ overflow: 'hidden' }}>
          {notifs.map(n => (
            <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
              <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
                {TYPE_ICON[n.type] || '💬'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="notif-text">{n.text}</div>
                <div className="notif-time">{fmtTime(n.created_at)}</div>
              </div>
              {!n.is_read && <div className="notif-dot-unread" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
