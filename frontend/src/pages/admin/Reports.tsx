import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Calendar } from 'lucide-react'
import { api } from '../../api'
import type { AdminReport } from '../../types'

export function ReportsList() {
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
        <div>
          <div className="page-title">Отчёты</div>
          <div className="page-subtitle">История по дням</div>
        </div>
      </div>

      {loading ? (
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
