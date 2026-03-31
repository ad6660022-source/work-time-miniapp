import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'
import type { TaskDetail } from '../../types'

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Назначена', in_progress: 'В работе', done: 'Выполнена',
}
const STATUS_CLASS: Record<string, string> = {
  assigned: 'badge-assigned', in_progress: 'badge-progress', done: 'badge-done',
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { haptic } = useTelegram()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [myStatus, setMyStatus] = useState<string>('')
  const [myId, setMyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.auth.me().then(r => { if (r.user) setMyId(r.user.id) })
    api.tasks.detail(Number(id)).then(r => {
      setTask(r.task)
    }).catch(() => nav('/tasks'))
  }, [id])

  useEffect(() => {
    if (task && myId) {
      const mine = task.assignees.find(a => a.id === myId)
      if (mine) setMyStatus(mine.status)
    }
  }, [task, myId])

  const updateStatus = async (status: string) => {
    if (loading) return
    setLoading(true); setError('')
    try {
      await api.tasks.updateStatus(Number(id), status)
      setMyStatus(status)
      setTask(prev => prev ? {
        ...prev,
        assignees: prev.assignees.map(a => a.id === myId ? { ...a, status } : a)
      } : prev)
      haptic.success()
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (!task) return <div className="loader"><div className="spinner" /></div>

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-glass btn-sm" onClick={() => nav('/tasks')} style={{ padding: '10px' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div className="page-title" style={{ fontSize: 20 }}>Задача #{task.id}</div>
        </div>
        <span className={`badge ${STATUS_CLASS[myStatus]}`}>{STATUS_LABEL[myStatus]}</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="glass card slide-up" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-primary)' }}>{task.text}</p>
      </div>

      {/* My action */}
      {myStatus !== 'done' && (
        <div className="glass card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, fontWeight: 600 }}>МОЁ ДЕЙСТВИЕ</div>
          {myStatus === 'assigned' && (
            <button className="btn btn-primary btn-full" onClick={() => updateStatus('in_progress')} disabled={loading}>
              🔄 Взять в работу
            </button>
          )}
          {myStatus === 'in_progress' && (
            <button className="btn btn-green btn-full" onClick={() => updateStatus('done')} disabled={loading}>
              ✅ Отметить выполненной
            </button>
          )}
        </div>
      )}

      {myStatus === 'done' && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          ✅ Вы выполнили задачу. Ожидайте проверки от администратора.
        </div>
      )}

      {/* Assignees */}
      {task.assignees.length > 1 && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={15} color="var(--text-secondary)" />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>ИСПОЛНИТЕЛИ</span>
          </div>
          {task.assignees.map(a => (
            <div key={a.id} className="list-item" style={{ cursor: 'default' }}>
              <div className="list-item-content">
                <div className="list-item-title">{a.name}</div>
                <div className="list-item-subtitle">{a.position || '—'}</div>
              </div>
              <span className={`badge ${STATUS_CLASS[a.status] || ''}`}>{STATUS_LABEL[a.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
