import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Calendar, CheckCircle } from 'lucide-react'
import { api } from '../../api'
import type { AdminReport } from '../../types'

// ── Мой отчёт (для админа — та же форма что у сотрудника) ──────────────────
function MyReport() {
  type Step = 'done' | 'problems' | 'plans' | 'submitted'
  const [step, setStep] = useState<Step>('done')
  const [done, setDone] = useState('')
  const [problems, setProblems] = useState('')
  const [plans, setPlans] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existing, setExisting] = useState(false)
  const [shiftClosed, setShiftClosed] = useState<boolean | null>(null)

  useEffect(() => {
    api.shifts.today().then(r => {
      setShiftClosed(r.shift?.status === 'closed')
    }).catch(() => setShiftClosed(false))
    api.reports.today().then(r => {
      if (r.report) {
        setExisting(true)
        setDone(r.report.done || '')
        setProblems(r.report.problems || '')
        setPlans(r.report.plans || '')
        setStep('submitted')
      }
    }).catch(() => {})
  }, [])

  const submit = async () => {
    setLoading(true); setError('')
    try {
      await api.reports.submit(done || '—', problems || '—', plans || '—')
      setStep('submitted')
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (shiftClosed === false && step !== 'submitted') {
    return (
      <div className="glass card slide-up" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Смена ещё не завершена</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Отчёт можно написать после завершения рабочего дня
        </div>
      </div>
    )
  }

  if (step === 'submitted') {
    return (
      <div className="glass card slide-up" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <CheckCircle size={48} color="var(--green)" style={{ margin: '0 auto 14px' }} />
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          {existing ? 'Отчёт обновлён' : 'Отчёт отправлен'}
        </div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
          Сохранено в истории отчётов
        </div>
        <div className="divider" />
        <div style={{ textAlign: 'left', marginTop: 16 }}>
          <div className="section-label">Что сделано</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{done || '—'}</p>
          <div className="section-label">Проблемы</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{problems || '—'}</p>
          <div className="section-label">Планы</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{plans || '—'}</p>
        </div>
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-glass btn-full" onClick={() => setStep('done')}>✏️ Редактировать</button>
        </div>
      </div>
    )
  }

  const steps = [
    { key: 'done'     as Step, label: '✅ Что сделано сегодня?',  value: done,     set: setDone },
    { key: 'problems' as Step, label: '⚠️ Были проблемы?',        value: problems, set: setProblems },
    { key: 'plans'    as Step, label: '📅 Планы на завтра?',      value: plans,    set: setPlans },
  ]
  const idx = steps.findIndex(s => s.key === step)
  const cur = steps[idx]

  return (
    <div className="glass card slide-up">
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= idx ? 'var(--accent)' : 'var(--glass-border)',
            transition: 'background 0.3s'
          }} />
        ))}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{cur.label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Шаг {idx + 1} из {steps.length}
      </div>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <textarea
        className="input" rows={4}
        placeholder="Введите текст…"
        value={cur.value}
        onChange={e => cur.set(e.target.value)}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {idx > 0 && (
          <button className="btn btn-glass" style={{ flex: 1 }} onClick={() => setStep(steps[idx-1].key)}>
            Назад
          </button>
        )}
        {idx < steps.length - 1 ? (
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(steps[idx+1].key)}>
            Далее →
          </button>
        ) : (
          <button className="btn btn-green" style={{ flex: 2 }} onClick={submit} disabled={loading}>
            {loading ? 'Отправка…' : '✉️ Отправить'}
          </button>
        )}
      </div>
    </div>
  )
}

export function ReportsList() {
  const [tab, setTab] = useState<'history' | 'my'>('history')
  const [dates, setDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    api.reports.dates()
      .then(r => setDates(r.dates))
      .finally(() => setLoading(false))
  }, [])

  const fmt = (d: string) => new Date(d).toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">Отчёты</div>
      </div>

      {/* Переключатель */}
      <div className="glass-sm" style={{ display: 'flex', overflow: 'hidden', marginBottom: 16 }}>
        {(['history', 'my'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '12px', border: 'none', cursor: 'pointer', fontWeight: 600,
              fontSize: 14, transition: 'all 0.2s', fontFamily: 'inherit',
              background: tab === t ? 'rgba(124,111,247,0.25)' : 'transparent',
              color: tab === t ? 'var(--accent-2)' : 'var(--text-secondary)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t === 'history' ? '📅 История команды' : '✏️ Мой отчёт'}
          </button>
        ))}
      </div>

      {tab === 'my' ? (
        <MyReport />
      ) : loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : dates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <div className="empty-text">Отчётов пока нет</div>
        </div>
      ) : (
        <div className="glass" style={{ overflow: 'hidden' }}>
          {dates.map(d => (
            <div key={d} className="list-item" onClick={() => nav(`/admin/reports/${d}`)}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'rgba(124,111,247,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Calendar size={18} color="var(--accent-2)" />
              </div>
              <div className="list-item-content">
                <div className="list-item-title" style={{ textTransform: 'capitalize' }}>
                  {fmt(d)}
                </div>
                <div className="list-item-subtitle">{d}</div>
              </div>
              <ChevronRight size={16} className="list-item-right" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReportsByDate() {
  const { date } = useParams<{ date: string }>()
  const nav = useNavigate()
  const [reports, setReports] = useState<AdminReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    api.reports.byDate(date!)
      .then(r => setReports(r.reports))
      .finally(() => setLoading(false))
  }, [date])

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-glass btn-sm" onClick={() => nav('/admin/reports')} style={{ padding: '10px' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div className="page-title" style={{ fontSize: 20, textTransform: 'capitalize' }}>
            {date ? fmtDate(date) : ''}
          </div>
          <div className="page-subtitle">{reports.length} отчётов</div>
        </div>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <div className="empty-text">Нет отчётов за этот день</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map((r, i) => (
            <div key={i} className="glass" style={{ overflow: 'hidden' }}>
              {/* Header */}
              <div
                className="list-item"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: 'var(--glass-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)',
                }}>
                  {r.name[0]}
                </div>
                <div className="list-item-content">
                  <div className="list-item-title">{r.name}</div>
                  <div className="list-item-subtitle">{r.position || '—'}</div>
                </div>
                <ChevronRight
                  size={16}
                  className="list-item-right"
                  style={{ transform: expanded === i ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                />
              </div>

              {/* Body */}
              {expanded === i && (
                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }} className="fade-in">
                  <div className="divider" style={{ margin: '0 0 4px' }} />
                  <ReportBlock emoji="✅" label="Что сделано" text={r.done} />
                  <ReportBlock emoji="⚠️" label="Проблемы" text={r.problems} />
                  <ReportBlock emoji="📅" label="Планы" text={r.plans} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportBlock({ emoji, label, text }: { emoji: string; label: string; text?: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
        {emoji} {label}
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{text || '—'}</p>
    </div>
  )
}
