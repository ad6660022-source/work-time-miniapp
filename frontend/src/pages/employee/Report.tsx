import { useEffect, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { api } from '../../api'
import { useTelegram } from '../../hooks/useTelegram'

type Step = 'done' | 'problems' | 'plans' | 'submitted'

export default function Report() {
  const [step, setStep] = useState<Step>('done')
  const [done, setDone] = useState('')
  const [problems, setProblems] = useState('')
  const [plans, setPlans] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existing, setExisting] = useState(false)
  const { haptic } = useTelegram()

  useEffect(() => {
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
    if (loading) return
    setLoading(true); setError('')
    try {
      await api.reports.submit(done || '—', problems || '—', plans || '—')
      setStep('submitted')
      haptic.success()
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  if (step === 'submitted') {
    return (
      <div className="page fade-in">
        <div className="page-header">
          <div className="page-title">Отчёт</div>
        </div>
        <div className="glass card slide-up" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CheckCircle size={56} color="var(--green)" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            {existing ? 'Отчёт обновлён' : 'Отчёт отправлен'}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
            Администратор получил уведомление
          </div>
          <div className="divider" />
          <div style={{ textAlign: 'left' }}>
            <div className="section-label">Что сделано</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{done || '—'}</p>
            <div className="section-label">Проблемы</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{problems || '—'}</p>
            <div className="section-label">Планы</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{plans || '—'}</p>
          </div>
          <div style={{ height: 24 }} />
          <button className="btn btn-glass btn-full" onClick={() => setStep('done')}>
            Редактировать
          </button>
        </div>
      </div>
    )
  }

  const steps: { key: Step; label: string; placeholder: string; value: string; setValue: (v: string) => void }[] = [
    { key: 'done',     label: '✅ Что сделано сегодня?',  placeholder: 'Опишите выполненную работу…', value: done, setValue: setDone },
    { key: 'problems', label: '⚠️ Были проблемы?',        placeholder: 'Опишите возникшие проблемы…', value: problems, setValue: setProblems },
    { key: 'plans',    label: '📅 Планы на завтра?',      placeholder: 'Что планируете сделать завтра…', value: plans, setValue: setPlans },
  ]

  const stepIdx = steps.findIndex(s => s.key === step)
  const current = steps[stepIdx]

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-title">Отчёт</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {steps.map((s, i) => (
            <div key={s.key} style={{
              width: 28, height: 4, borderRadius: 2,
              background: i <= stepIdx ? 'var(--accent)' : 'var(--glass-border)',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>
      </div>

      <div className="glass card slide-up">
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{current.label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Шаг {stepIdx + 1} из {steps.length}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

        <textarea
          className="input"
          placeholder={current.placeholder}
          value={current.value}
          onChange={e => current.setValue(e.target.value)}
          rows={5}
          autoFocus
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {stepIdx > 0 && (
            <button
              className="btn btn-glass"
              style={{ flex: 1 }}
              onClick={() => setStep(steps[stepIdx - 1].key)}
            >
              Назад
            </button>
          )}
          {stepIdx < steps.length - 1 ? (
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={() => setStep(steps[stepIdx + 1].key)}
            >
              Далее →
            </button>
          ) : (
            <button
              className="btn btn-green"
              style={{ flex: 2 }}
              onClick={submit}
              disabled={loading}
            >
              {loading ? 'Отправка…' : '✉️ Отправить отчёт'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
