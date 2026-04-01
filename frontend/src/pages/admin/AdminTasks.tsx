import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, X, Trash2 } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'
import type { AdminTask, User } from '../../types'

export default function AdminTasks() {
  const nav = useNavigate()
  const { haptic } = useTelegram()
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [taskText, setTaskText] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [t, e] = await Promise.all([api.tasks.all(), api.users.employees()])
      setTasks(t.tasks)
      setEmployees(e.employees)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const toggleSelect = (id: number) => {
    haptic.light()
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const createTask = async () => {
    if (!taskText.trim()) { setError('Введите текст задачи'); return }
    if (selected.length === 0) { setError('Выберите исполнителей'); return }
    setCreating(true); setError('')
    try {
      await api.tasks.create(taskText.trim(), selected)
      setTaskText(''); setSelected([]); setShowCreate(false)
      haptic.success()
      await load()
    } catch (e: any) { setError(e.message) }
    setCreating(false)
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Задачи</div>
          <div className="page-subtitle">{tasks.length} активных</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-glass btn-sm"
            title="Очистить выполненные"
            onClick={async () => {
              if (!confirm('Архивировать все полностью выполненные задачи?')) return
              try {
                const r = await api.tasks.clearCompleted()
                haptic.success()
                await load()
              } catch {}
            }}
          >
            <Trash2 size={16} />
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowCreate(!showCreate); setError('') }}
          >
            {showCreate ? <X size={16} /> : <><Plus size={16} /> Создать</>}
          </button>
        </div>
      </div>

      {/* Create panel */}
      {showCreate && (
        <div className="glass card slide-up" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 14 }}>
            НОВАЯ ЗАДАЧА
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="input-wrap">
            <label className="input-label">Текст задачи</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Что нужно сделать…"
              value={taskText}
              onChange={e => setTaskText(e.target.value)}
            />
          </div>

          <div className="input-label" style={{ marginBottom: 10 }}>Исполнители</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
            {employees.map(emp => (
              <div
                key={emp.id}
                onClick={() => toggleSelect(emp.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  background: selected.includes(emp.id) ? 'rgba(124,111,247,0.15)' : 'var(--glass-bg)',
                  border: `1px solid ${selected.includes(emp.id) ? 'rgba(124,111,247,0.4)' : 'var(--glass-border)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: `2px solid ${selected.includes(emp.id) ? 'var(--accent)' : 'var(--glass-border)'}`,
                  background: selected.includes(emp.id) ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {selected.includes(emp.id) && <span style={{ fontSize: 12, color: '#fff' }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{emp.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{emp.position || '—'}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-glass" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>
              Отмена
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={createTask}
              disabled={creating}
            >
              {creating ? 'Создание…' : `📨 Назначить (${selected.length})`}
            </button>
          </div>
        </div>
      )}

      {/* Tasks list */}
      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">Задач нет</div>
        </div>
      ) : (
        <div className="glass" style={{ overflow: 'hidden' }}>
          {tasks.map(task => {
            const total = (task.cnt_assigned || 0) + (task.cnt_in_progress || 0) + (task.cnt_done || 0)
            const donePct = total ? Math.round((task.cnt_done || 0) / total * 100) : 0
            return (
              <div
                key={task.id}
                className="list-item"
                onClick={() => nav(`/admin/tasks/${task.id}`)}
              >
                <div className="list-item-content">
                  <div className="list-item-title" style={{ marginBottom: 8 }}>
                    {task.text.length > 60 ? task.text.slice(0, 60) + '…' : task.text}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {task.cnt_assigned > 0 && (
                      <span className="badge badge-assigned">📌 {task.cnt_assigned}</span>
                    )}
                    {task.cnt_in_progress > 0 && (
                      <span className="badge badge-progress">🔄 {task.cnt_in_progress}</span>
                    )}
                    {task.cnt_done > 0 && (
                      <span className="badge badge-done">✅ {task.cnt_done}</span>
                    )}
                  </div>
                  {total > 0 && (
                    <div className="progress-bar" style={{ marginTop: 8 }}>
                      <div className="progress-fill" style={{ width: `${donePct}%` }} />
                    </div>
                  )}
                </div>
                <ChevronRight size={16} className="list-item-right" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
