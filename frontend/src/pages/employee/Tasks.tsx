import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { api } from '../../api'
import type { Task } from '../../types'

const STATUS_LABEL: Record<string, string> = {
  assigned:    'Назначена',
  in_progress: 'В работе',
  done:        'Выполнена',
}
const STATUS_CLASS: Record<string, string> = {
  assigned:    'badge-assigned',
  in_progress: 'badge-progress',
  done:        'badge-done',
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.tasks.my()
      setTasks(r.tasks)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const counts = tasks.reduce((acc, t) => {
    acc[t.assignment_status] = (acc[t.assignment_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Задачи</div>
          <div className="page-subtitle">{tasks.length} активных</div>
        </div>
        <button className="btn btn-glass btn-sm" onClick={load} style={{ padding: '10px' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary */}
      {tasks.length > 0 && (
        <div className="glass card" style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber)' }}>{counts.assigned || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Ожидают</div>
          </div>
          <div style={{ width: 1, background: 'var(--glass-border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)' }}>{counts.in_progress || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>В работе</div>
          </div>
          <div style={{ width: 1, background: 'var(--glass-border)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{counts.done || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Готово</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-text">Задач нет</div>
        </div>
      ) : (
        <div className="glass" style={{ overflow: 'hidden' }}>
          {tasks.map(task => (
            <div
              key={task.id}
              className="list-item"
              onClick={() => nav(`/tasks/${task.id}`)}
            >
              <div className="list-item-content">
                <div className="list-item-title" style={{ marginBottom: 6 }}>
                  {task.text.length > 60 ? task.text.slice(0, 60) + '…' : task.text}
                </div>
                <span className={`badge ${STATUS_CLASS[task.assignment_status]}`}>
                  {STATUS_LABEL[task.assignment_status]}
                </span>
              </div>
              <ChevronRight size={16} className="list-item-right" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
