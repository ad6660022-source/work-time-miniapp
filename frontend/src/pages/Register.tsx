import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { api } from '../api'
import { useTelegram } from '../hooks/useTelegram'

interface Props {
  onRegistered: () => void
  tgFirstName?: string
}

export default function Register({ onRegistered, tgFirstName }: Props) {
  const [name, setName] = useState(tgFirstName || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { haptic } = useTelegram()

  const submit = async () => {
    if (name.trim().length < 2) { setError('Введите имя и фамилию (минимум 2 символа)'); return }
    setLoading(true); setError('')
    try {
      await api.auth.register(name.trim())
      haptic.success()
      onRegistered()
    } catch (e: any) {
      setError(e.message)
      haptic.error()
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: 'linear-gradient(135deg, #7c6ff7, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(124,111,247,0.4)',
          }}>
            <UserPlus size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Добро пожаловать!</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Введите своё имя — так вас будут видеть в команде
          </p>
        </div>

        <div className="glass card slide-up">
          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="input-wrap">
            <label className="input-label">Имя и фамилия</label>
            <input
              className="input"
              placeholder="Например: Андрей Петров"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={submit}
            disabled={loading}
          >
            {loading ? 'Отправка…' : '→ Отправить заявку'}
          </button>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>
          После регистрации администратор одобрит вашу заявку
        </p>
      </div>
    </div>
  )
}
