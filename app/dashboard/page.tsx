'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { GOALS, CATEGORIES, BUSINESS_AREAS, WorkEntry } from '@/lib/supabase'

/* ── Types ── */
interface TaskRow {
  id: string
  category: string
  business_area: string
  report_name: string
  etl_job_name: string
  task_details: string
  time_taken: string
  status: 'Complete' | 'WIP'
  goals: string
  comment: string
}

interface User { name: string; email: string; isManager: boolean }

const MONTHS = ['All','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const STATUS_OPTIONS = ['All', 'Complete', 'WIP']

function makeBlankRow(): TaskRow {
  return {
    id: Math.random().toString(36).slice(2),
    category: '',
    business_area: '',
    report_name: '',
    etl_job_name: '',
    task_details: '',
    time_taken: '',
    status: 'WIP',
    goals: '',
    comment: '',
  }
}

/* ══════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [entries, setEntries] = useState<WorkEntry[]>([])
  const [filtered, setFiltered] = useState<WorkEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notify, setNotify] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  /* view: 'list' | 'add' | 'edit' */
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list')
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null)

  /* filters */
  const [filterMonth, setFilterMonth] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterWeek, setFilterWeek] = useState('All')

  /* multi-task form state */
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [taskRows, setTaskRows] = useState<TaskRow[]>([makeBlankRow()])

  /* single-row edit form */
  const [editForm, setEditForm] = useState<Partial<WorkEntry>>({})

  /* ── Auth ── */
  useEffect(() => {
    const stored = localStorage.getItem('wr_user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    if (u.isManager) { router.push('/manager'); return }
    setUser(u)
  }, [router])

  /* ── Fetch ── */
  const fetchEntries = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const res = await fetch(`/api/entries?email=${user.email}`)
    const data = await res.json()
    setEntries(data.entries || [])
    setLoading(false)
  }, [user])

  useEffect(() => { if (user) fetchEntries() }, [user, fetchEntries])

  /* ── Filter logic ── */
  useEffect(() => {
    let result = [...entries]
    if (filterMonth !== 'All') {
      const mIdx = MONTHS.indexOf(filterMonth)
      result = result.filter(e => new Date(e.date).getMonth() + 1 === mIdx)
    }
    if (filterStatus !== 'All') {
      result = result.filter(e => e.status === filterStatus)
    }
    if (filterWeek !== 'All') {
      const now = new Date()
      let start = new Date()
      if (filterWeek === 'This Week') {
        start.setDate(now.getDate() - now.getDay())
      } else if (filterWeek === 'Last Week') {
        start.setDate(now.getDate() - now.getDay() - 7)
        const end = new Date(start); end.setDate(start.getDate() + 6)
        result = result.filter(e => { const d = new Date(e.date); return d >= start && d <= end })
      } else if (filterWeek === 'Last 7 Days') {
        start.setDate(now.getDate() - 7)
      }
      if (filterWeek !== 'Last Week') {
        result = result.filter(e => new Date(e.date) >= start)
      }
    }
    setFiltered(result)
  }, [entries, filterMonth, filterStatus, filterWeek])

  /* ── Notify ── */
  function showNotify(msg: string, type: 'success' | 'error') {
    setNotify({ msg, type })
    setTimeout(() => setNotify(null), 3000)
  }

  /* ── Task row helpers ── */
  function updateRow(id: string, field: keyof TaskRow, value: string) {
    setTaskRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  function addRow() { setTaskRows(rows => [...rows, makeBlankRow()]) }
  function removeRow(id: string) {
    if (taskRows.length === 1) return
    setTaskRows(rows => rows.filter(r => r.id !== id))
  }

  /* ── Validate multi-task ── */
  function validateMultiTask(): boolean {
    for (const row of taskRows) {
      if (!row.category) { showNotify('Select category for all tasks', 'error'); return false }
      if (!row.business_area) { showNotify('Select business area for all tasks', 'error'); return false }
      if (!row.task_details.trim()) { showNotify('Task details required for all tasks', 'error'); return false }
      if (!row.time_taken || isNaN(Number(row.time_taken)) || Number(row.time_taken) <= 0) {
        showNotify('Valid hours required for all tasks', 'error'); return false
      }
      if (!row.goals) { showNotify('Select a goal for all tasks', 'error'); return false }
    }
    const totalHours = taskRows.reduce((sum, r) => sum + Number(r.time_taken), 0)
    if (totalHours < 7) {
      showNotify(`Total hours for the day must be at least 7 (currently ${totalHours})`, 'error')
      return false
    }
    return true
  }

  /* ── Submit multi-task ── */
  async function handleMultiSubmit() {
    if (!validateMultiTask()) return
    setSaving(true)
    try {
      const promises = taskRows.map(row =>
        fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_email: user!.email,
            employee_name: user!.name,
            date: entryDate,
            category: row.category,
            business_area: row.business_area,
            report_name: row.report_name,
            etl_job_name: row.etl_job_name,
            task_details: row.task_details,
            time_taken: Number(row.time_taken),
            status: row.status,
            goals: row.goals,
            comment: row.comment,
          }),
        })
      )
      await Promise.all(promises)
      showNotify(`${taskRows.length} task(s) saved successfully!`, 'success')
      setTaskRows([makeBlankRow()])
      setEntryDate(format(new Date(), 'yyyy-MM-dd'))
      setView('list')
      fetchEntries()
    } catch {
      showNotify('Failed to save entries', 'error')
    }
    setSaving(false)
  }

  /* ── Edit submit ── */
  async function handleEditSubmit() {
    if (!editForm.task_details) return showNotify('Task details required', 'error')
    if (!editForm.time_taken) return showNotify('Time taken required', 'error')
    if (Number(editForm.time_taken) > 24) return showNotify('Time cannot exceed 24 hours', 'error')
    if (!editForm.goals) return showNotify('Please select a goal', 'error')
    setSaving(true)
    try {
      await fetch('/api/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedEntry!.id, ...editForm }),
      })
      showNotify('Entry updated!', 'success')
      setView('list')
      fetchEntries()
    } catch {
      showNotify('Failed to update entry', 'error')
    }
    setSaving(false)
  }

  /* ── Delete ── */
  async function handleDelete(id: number) {
    if (!confirm('Delete this entry?')) return
    await fetch('/api/entries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    showNotify('Entry deleted', 'success')
    fetchEntries()
  }

  /* ── Edit open ── */
  function handleEdit(entry: WorkEntry) {
    setSelectedEntry(entry)
    setEditForm({ ...entry })
    setView('edit')
  }

  /* ── Export ── */
  function exportToExcel(type: 'all' | 'monthly' | 'weekly') {
    const now = new Date()
    let exportData = entries
    if (type === 'monthly') {
      exportData = entries.filter(e => {
        const d = new Date(e.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
    } else if (type === 'weekly') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
      exportData = entries.filter(e => new Date(e.date) >= weekAgo)
    }
    const data = exportData.map(e => ({
      Date: e.date, Category: e.category, 'Business Area': e.business_area,
      'Report Name': e.report_name, 'ETL Job': e.etl_job_name,
      'Task Details': e.task_details, 'Time Taken (hrs)': e.time_taken,
      Status: e.status, Goals: e.goals, Comment: e.comment,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Work Register')
    XLSX.writeFile(wb, `work-register-${type}-${format(now, 'yyyy-MM-dd')}.xlsx`)
  }

  /* ── Total hours for today's entry ── */
  const totalEntryHours = taskRows.reduce((s, r) => s + (Number(r.time_taken) || 0), 0)

  /* ══════════ RENDER ══════════ */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top Nav ── */}
      <nav style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>W</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Work Register</span>
          <span style={{ color: 'var(--border)', fontSize: 18 }}>|</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sintex Digital Team</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {view === 'list' && (
            <button className="btn-primary" style={{ padding: '7px 16px', fontSize: 13 }}
              onClick={() => { setTaskRows([makeBlankRow()]); setEntryDate(format(new Date(), 'yyyy-MM-dd')); setView('add') }}>
              + New Entry
            </button>
          )}
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#e8eef6', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{user?.name}</span>
          <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}
            onClick={() => { localStorage.removeItem('wr_user'); router.push('/login') }}>
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Notification ── */}
      {notify && (
        <div style={{
          position: 'fixed', top: 68, right: 24, zIndex: 999,
          background: notify.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${notify.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: notify.type === 'success' ? '#15803d' : '#b91c1c',
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {notify.msg}
        </div>
      )}

      <div style={{ flex: 1, padding: '20px 24px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>

        {/* ══════ LIST VIEW ══════ */}
        {view === 'list' && (
          <>
            {/* ── Filters ── */}
            <div style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '14px 20px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 20,
              flexWrap: 'wrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              {/* Month filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Month
                </label>
                <select className="input-field" style={{ width: 130 }}
                  value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>

              {/* Status filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </label>
                <select className="input-field" style={{ width: 130 }}
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              {/* Week filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Week
                </label>
                <select className="input-field" style={{ width: 140 }}
                  value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
                  {['All', 'This Week', 'Last Week', 'Last 7 Days'].map(w => <option key={w}>{w}</option>)}
                </select>
              </div>

              {/* Divider */}
              <div style={{ borderLeft: '1px solid var(--border)', height: 36, marginLeft: 4 }} />

              {/* Export */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Export
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => exportToExcel('all')}>All</button>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => exportToExcel('monthly')}>Monthly</button>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => exportToExcel('weekly')}>Weekly</button>
                </div>
              </div>

              <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>
                {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}
              </div>
            </div>

            {/* ── Table ── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No entries found.{' '}
                  <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setView('add')}>Add your first entry</span>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--header-bg)' }}>
                        {['Date', 'Category', 'Business Area', 'Task Details', 'Time (h)', 'Goals', 'Status', ''].map(h => (
                          <th key={h} style={{
                            padding: '11px 16px', textAlign: 'left',
                            color: 'var(--text-secondary)', fontWeight: 600,
                            fontSize: 12, whiteSpace: 'nowrap',
                            borderBottom: '1px solid var(--border)',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry, i) => (
                        <tr key={entry.id}
                          style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : 'var(--bg-card2)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : 'var(--bg-card2)')}>
                          <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{entry.date}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{entry.category}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{entry.business_area}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.task_details}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 600 }}>{entry.time_taken}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.goals}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span className={entry.status === 'Complete' ? 'badge-complete' : 'badge-wip'}>{entry.status}</span>
                          </td>
                          <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleEdit(entry)} style={{
                              background: 'white', border: '1px solid var(--border)',
                              color: 'var(--text-secondary)', padding: '4px 10px',
                              borderRadius: 5, fontSize: 12, cursor: 'pointer', marginRight: 6,
                            }}>Edit</button>
                            <button onClick={() => handleDelete(entry.id!)} style={{
                              background: 'white', border: '1px solid #fecaca',
                              color: '#dc2626', padding: '4px 10px',
                              borderRadius: 5, fontSize: 12, cursor: 'pointer',
                            }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════ ADD VIEW — multi-task ══════ */}
        {view === 'add' && (
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Add New Entry</h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Add multiple tasks for the same day. Total hours must be ≥ 7.
                </p>
              </div>
              <button className="btn-secondary" onClick={() => setView('list')}>← Back</button>
            </div>

            <div className="card">
              {/* Date row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Date *</label>
                  <input className="input-field" type="date" style={{ width: 180 }}
                    value={entryDate} onChange={e => setEntryDate(e.target.value)} required />
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    background: totalEntryHours >= 7 ? '#dcfce7' : '#fef9c3',
                    color: totalEntryHours >= 7 ? '#15803d' : '#a16207',
                    border: `1px solid ${totalEntryHours >= 7 ? '#bbf7d0' : '#fde68a'}`,
                    padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  }}>
                    Total: {totalEntryHours}h {totalEntryHours >= 7 ? '✓' : `(need ${7 - totalEntryHours} more)`}
                  </div>
                </div>
              </div>

              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '0.9fr 0.9fr 0.8fr 0.8fr 1.4fr 0.55fr 0.7fr 0.9fr 0.7fr 36px',
                gap: 8,
                marginBottom: 6,
                padding: '0 4px',
              }}>
                {['Category', 'Business Area', 'Report Name', 'ETL Job', 'Task Details *', 'Hours *', 'Status', 'Goals *', 'Comment', ''].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                ))}
              </div>

              {/* Task rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {taskRows.map((row, idx) => (
                  <div key={row.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '0.9fr 0.9fr 0.8fr 0.8fr 1.4fr 0.55fr 0.7fr 0.9fr 0.7fr 36px',
                    gap: 8,
                    alignItems: 'start',
                    background: idx % 2 === 0 ? 'white' : '#f8fafc',
                    padding: '8px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <select className="input-field" value={row.category}
                      onChange={e => updateRow(row.id, 'category', e.target.value)}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>

                    <select className="input-field" value={row.business_area}
                      onChange={e => updateRow(row.id, 'business_area', e.target.value)}>
                      <option value="">Select…</option>
                      {BUSINESS_AREAS.map(b => <option key={b}>{b}</option>)}
                    </select>

                    <input className="input-field" type="text" placeholder="Report name"
                      value={row.report_name} onChange={e => updateRow(row.id, 'report_name', e.target.value)} />

                    <input className="input-field" type="text" placeholder="ETL job"
                      value={row.etl_job_name} onChange={e => updateRow(row.id, 'etl_job_name', e.target.value)} />

                    <input className="input-field" type="text" placeholder="Describe the task…"
                      value={row.task_details} onChange={e => updateRow(row.id, 'task_details', e.target.value)} />

                    <input className="input-field" type="number" placeholder="hrs" min="0.5" max="24" step="0.5"
                      value={row.time_taken} onChange={e => updateRow(row.id, 'time_taken', e.target.value)} />

                    <select className="input-field" value={row.status}
                      onChange={e => updateRow(row.id, 'status', e.target.value as 'Complete' | 'WIP')}>
                      <option>WIP</option>
                      <option>Complete</option>
                    </select>

                    <select className="input-field" value={row.goals}
                      onChange={e => updateRow(row.id, 'goals', e.target.value)}>
                      <option value="">Select…</option>
                      {GOALS.map(g => <option key={g}>{g}</option>)}
                    </select>

                    <input className="input-field" type="text" placeholder="Optional"
                      value={row.comment} onChange={e => updateRow(row.id, 'comment', e.target.value)} />

                    <button onClick={() => removeRow(row.id)}
                      title="Remove row"
                      style={{
                        width: 30, height: 30, borderRadius: 6,
                        background: taskRows.length === 1 ? '#f8f8f8' : '#fef2f2',
                        border: `1px solid ${taskRows.length === 1 ? 'var(--border)' : '#fecaca'}`,
                        color: taskRows.length === 1 ? 'var(--text-muted)' : '#dc2626',
                        cursor: taskRows.length === 1 ? 'not-allowed' : 'pointer',
                        fontSize: 16, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      disabled={taskRows.length === 1}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add row + Save */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <button className="btn-secondary" onClick={addRow} style={{ fontSize: 13 }}>
                  + Add Another Task
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-secondary" onClick={() => setView('list')}>Cancel</button>
                  <button className="btn-primary" onClick={handleMultiSubmit} disabled={saving}>
                    {saving ? 'Saving…' : `Save ${taskRows.length} Task${taskRows.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ EDIT VIEW ══════ */}
        {view === 'edit' && selectedEntry && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Entry</h1>
              <button className="btn-secondary" onClick={() => setView('list')}>← Back</button>
            </div>
            <div className="card">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Date */}
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input className="input-field" type="date"
                    value={editForm.date || ''} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                {/* Status */}
                <div>
                  <label style={labelStyle}>Status *</label>
                  <select className="input-field" value={editForm.status || 'WIP'}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value as 'Complete' | 'WIP' }))}>
                    <option>WIP</option><option>Complete</option>
                  </select>
                </div>
                {/* Category */}
                <div>
                  <label style={labelStyle}>Category *</label>
                  <select className="input-field" value={editForm.category || ''}
                    onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} required>
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                {/* Business Area */}
                <div>
                  <label style={labelStyle}>Business Area *</label>
                  <select className="input-field" value={editForm.business_area || ''}
                    onChange={e => setEditForm(f => ({ ...f, business_area: e.target.value }))} required>
                    <option value="">Select area</option>
                    {BUSINESS_AREAS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                {/* Report Name */}
                <div>
                  <label style={labelStyle}>Report Name</label>
                  <input className="input-field" type="text"
                    value={editForm.report_name || ''} onChange={e => setEditForm(f => ({ ...f, report_name: e.target.value }))} />
                </div>
                {/* ETL Job */}
                <div>
                  <label style={labelStyle}>ETL Job Name</label>
                  <input className="input-field" type="text"
                    value={editForm.etl_job_name || ''} onChange={e => setEditForm(f => ({ ...f, etl_job_name: e.target.value }))} />
                </div>
                {/* Goals */}
                <div>
                  <label style={labelStyle}>Goals *</label>
                  <select className="input-field" value={editForm.goals || ''}
                    onChange={e => setEditForm(f => ({ ...f, goals: e.target.value }))} required>
                    <option value="">Select goal</option>
                    {GOALS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                {/* Time */}
                <div>
                  <label style={labelStyle}>Time Taken (hrs) *</label>
                  <input className="input-field" type="number" min="0.5" max="24" step="0.5"
                    value={editForm.time_taken || ''} onChange={e => setEditForm(f => ({ ...f, time_taken: Number(e.target.value) }))} required />
                </div>
                {/* Task Details */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Task Details *</label>
                  <textarea className="input-field" rows={3}
                    value={editForm.task_details || ''} onChange={e => setEditForm(f => ({ ...f, task_details: e.target.value }))} required />
                </div>
                {/* Comment */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Comment</label>
                  <input className="input-field" type="text"
                    value={editForm.comment || ''} onChange={e => setEditForm(f => ({ ...f, comment: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button className="btn-secondary" onClick={() => setView('list')}>Cancel</button>
                <button className="btn-primary" onClick={handleEditSubmit} disabled={saving}>
                  {saving ? 'Saving…' : 'Update Entry'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 5,
}