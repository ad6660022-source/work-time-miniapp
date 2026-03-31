import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../api'
import type { TaskDetail } from '../../types'

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Назначена', in_progress: 'В работе', done: 'Выполнена',
}
const STATUS_CLASS: Record<string, string> = {
  assigned: 'badge-assigned', in_progress: 'badge-progress', done: 'badge-done',
}

export default function AdminTaskDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [task, setTask] = useState<TaskDetail | null>(null)

  useEffect(() => {
    api.tasks.detail(Number(id))
      .then(r => setTask(r.task))
      .catch(() => nav('/admin/tasks'))
  }, [id])

  if (!task) return <div className="loader"><div className="spinner" /></div>

  const total = task.assignees.length
  const done  = task.assignees.filter(a => a.status === 'done').length
  const donePct = total ? Math.round(done / total * 100) : 0

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-glass btn-sm" onClick={() => nav('/admin/tasks')} style={{ padding: '10px' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div className="page-title" style={{ fontSize: 20 }}>Задача #{task.id}</div>
          <div className="page-subtitle">
            {new Date(task.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      <div className="glass card slide-up" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 16, lineHeight: 1.65 }}>{task.text}</p>
      </div>

      {/* Progress */}
      <div className="glass card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>Прогресс</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{done}/{total} выполнено</span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className="progress-fill" style={{ width: `${donePct}%` }} />
        </div>
      </div>

      {/* Assignees */}
      <div className="section-label">Исполнители</div>
      <div className="glass" style={{ overflow: 'hidden' }}>
        {task.assignees.map(a => (
          <div key={a.id} className="list-item" style={{ cursor: 'default' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: 'var(--glass-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)',
            }}>
              {a.name[0]}
            </div>
            <div className="list-item-content">
              <div className="list-item-title">{a.name}</div>
              <div className="list-item-subtitle">{a.position || '—'}</div>
            </div>
            <span className={`badge ${STATUS_CLASS[a.status] || ''}`}>
              {STATUS_LABEL[a.status] || a.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
