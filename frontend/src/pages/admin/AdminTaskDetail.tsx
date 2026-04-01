import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'
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
  const { haptic } = useTelegram()
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.tasks.detail(Number(id))
      .then(r => { setTask(r.task); setEditText(r.task.text) })
      .catch(() => nav('/admin/tasks'))
  }, [id])

  if (!task) return <div className="loader"><div className="spinner" /></div>

  const total = task.assignees.length
  const done  = task.assignees.filter(a => a.status === 'done').length
  const donePct = total ? Math.round(done / total * 100) : 0

  const saveEdit = async () => {
    if (!editText.trim()) return
    setSaving(true)
    try {
      const r = await api.tasks.update(task.id, editText.trim())
      setTask(r.task)
      setEditing(false)
      setMsg('Задача обновлена')
      haptic.success()
    } catch (e: any) { setMsg('Ошибка: ' + e.message) }
    setSaving(false)
  }

  const deleteTask = async () => {
    if (!confirm('Удалить задачу?')) return
    try {
      await api.tasks.delete(task.id)
      haptic.success()
      nav('/admin/tasks')
    } catch (e: any) { setMsg('Ошибка: ' + e.message) }
  }

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-glass btn-sm" onClick={() => setEditing(!editing)} style={{ padding: '10px' }}>
            <Pencil size={16} />
          </button>
          <button className="btn btn-glass btn-sm" onClick={deleteTask} style={{ padding: '10px', color: 'var(--red)' }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{msg}</div>}

      <div className="glass card slide-up" style={{ marginBottom: 12 }}>
        {editing ? (
          <>
            <textarea
              className="input"
              rows={5}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn btn-glass" style={{ flex: 1 }} onClick={() => { setEditing(false); setEditText(task.text) }}>
                Отмена
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEdit} disabled={saving}>
                {saving ? 'Сохранение…' : '💾 Сохранить'}
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 16, lineHeight: 1.65 }}>{task.text}</p>
        )}
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
