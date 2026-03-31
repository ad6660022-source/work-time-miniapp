import { Clock } from 'lucide-react'

export default function Pending() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: 'rgba(251,191,36,0.15)',
          border: '1px solid rgba(251,191,36,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <Clock size={32} color="var(--amber)" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Заявка отправлена</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
          Ваша заявка ожидает одобрения администратора.<br />
          Как только вас одобрят — вы получите уведомление в Telegram.
        </p>
      </div>
    </div>
  )
}
