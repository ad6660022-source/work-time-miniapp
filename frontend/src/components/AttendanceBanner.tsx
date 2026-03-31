import { useEffect, useState, useCallback } from 'react'
import { MapPin, CheckCircle } from 'lucide-react'
import { api } from '../api'
import { useTelegram } from '../hooks/useTelegram'

export default function AttendanceBanner() {
  const [check, setCheck] = useState<{
    id: number
    seconds_left: number
    user_responded: boolean
  } | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [responding, setResponding] = useState(false)
  const { haptic } = useTelegram()

  const loadCheck = useCallback(async () => {
    try {
      const r = await api.attendance.active()
      setCheck(r.check)
      if (r.check) setCountdown(r.check.seconds_left)
    } catch {}
  }, [])

  useEffect(() => {
    loadCheck()
    const t = setInterval(loadCheck, 10_000)
    return () => clearInterval(t)
  }, [loadCheck])

  // Countdown tick
  useEffect(() => {
    if (!check || check.user_responded) return
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { loadCheck(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [check, loadCheck])

  const respond = async () => {
    if (responding) return
    setResponding(true)
    try {
      await api.attendance.respond()
      setCheck(prev => prev ? { ...prev, user_responded: true } : prev)
      haptic.success()
    } catch {}
    setResponding(false)
  }

  if (!check) return null

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0')
  const secs = String(countdown % 60).padStart(2, '0')

  if (check.user_responded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px', borderRadius: 16, marginBottom: 12,
        background: 'rgba(52,211,153,0.1)',
        border: '1px solid rgba(52,211,153,0.3)',
      }}>
        <CheckCircle size={22} color="var(--green)" flexShrink={0} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>Вы отметились ✓</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Присутствие зафиксировано</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      borderRadius: 16, marginBottom: 12, overflow: 'hidden',
      border: '1px solid rgba(251,191,36,0.4)',
      background: 'rgba(251,191,36,0.08)',
      animation: 'pulse 2s ease infinite',
    }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <MapPin size={20} color="var(--amber)" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)' }}>
              📍 Проверка на месте!
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Осталось: <b style={{ color: 'var(--amber)' }}>{mins}:{secs}</b>
            </div>
          </div>
        </div>
        <button
          className="btn btn-full"
          style={{
            background: 'linear-gradient(135deg, #d97706, #fbbf24)',
            color: '#000', fontWeight: 700, fontSize: 15,
            boxShadow: '0 4px 18px rgba(251,191,36,0.4)',
          }}
          onClick={respond}
          disabled={responding}
        >
          ✋ Я на месте!
        </button>
      </div>
    </div>
  )
}
