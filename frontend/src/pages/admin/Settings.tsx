import { useEffect, useState } from 'react'
import { Save, Hash } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'

interface SettingsState {
  group_chat_id: string
  notify_tasks: boolean
  notify_attendance: boolean
  notify_announcements: boolean
  notify_reports: boolean
  notify_late: boolean
}

type NotifyKey = 'notify_tasks' | 'notify_attendance' | 'notify_announcements' | 'notify_reports' | 'notify_late'

export default function Settings() {
  const { haptic } = useTelegram()
  const [form, setForm] = useState<SettingsState>({
    group_chat_id: '',
    notify_tasks: true,
    notify_attendance: true,
    notify_announcements: true,
    notify_reports: true,
    notify_late: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.settings.get()
      .then(r => setForm(r))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      await api.settings.save(form)
      haptic.success()
      setMsg('✅ Настройки сохранены')
    } catch (e: any) { setMsg('Ошибка: ' + e.message) }
    setSaving(false)
  }

  const toggle = (key: NotifyKey) => {
    haptic.light()
    setForm(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) return <div className="loader"><div className="spinner" /></div>

  const notifyOptions: { key: NotifyKey; label: string; desc: string }[] = [
    { key: 'notify_tasks',         label: '📌 Задачи',              desc: 'Создание и выполнение задач' },
    { key: 'notify_attendance',    label: '📍 Проверка присутствия', desc: 'Запуск и итоги проверки' },
    { key: 'notify_announcements', label: '📢 Объявления',           desc: 'Объявления от администраторов' },
    { key: 'notify_reports',       label: '📊 Отчёты',              desc: 'Сводка в 19:05 + кто не сдал в 19:30' },
    { key: 'notify_late',          label: '🔴 Опоздания',           desc: 'Список опоздавших в 9:15' },
  ]

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">Настройки</div>
      </div>

      {msg && (
        <div className={`alert ${msg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {/* Группа */}
      <div className="glass card slide-up" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 14 }}>
          💬 ГРУППА TELEGRAM
        </div>
        <div className="input-wrap">
          <label className="input-label">Chat ID группы</label>
          <div style={{ position: 'relative' }}>
            <Hash size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="-1001234567890"
              value={form.group_chat_id}
              onChange={e => setForm(prev => ({ ...prev, group_chat_id: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
          Добавьте бота в группу и используйте команду <b>/chatid</b> чтобы узнать ID, или перешлите любое сообщение из группы боту @userinfobot.
          ID супергрупп начинается с <b>-100</b>.
        </div>
      </div>

      {/* Уведомления в группу */}
      <div className="glass card slide-up" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 14 }}>
          🔔 РАССЫЛКА В ГРУППУ
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {notifyOptions.map(opt => (
            <div
              key={opt.key}
              onClick={() => toggle(opt.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 4px', cursor: 'pointer',
                borderBottom: '1px solid var(--glass-border)',
              }}
            >
              <div style={{
                width: 44, height: 26, borderRadius: 13, flexShrink: 0,
                background: form[opt.key] ? 'var(--accent)' : 'var(--glass-border)',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: form[opt.key] ? 21 : 3,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opt.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={save}
        disabled={saving}
      >
        <Save size={16} /> {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  )
}
