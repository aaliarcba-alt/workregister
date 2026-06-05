'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GOALS, CATEGORIES, BUSINESS_AREAS, WorkEntry } from '@/lib/supabase'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

type User = { id: string; name: string; email: string; designation: string; isManager: boolean }

const MONTHS = ['All','January','February','March','April','May','June','July','August','September','October','November','December']

/* ── Multi-task row type ── */
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

function makeBlankRow(): TaskRow {
  return {
    id: Math.random().toString(36).slice(2),
    category: '', business_area: '', report_name: '', etl_job_name: '',
    task_details: '', time_taken: '', status: 'WIP', goals: '', comment: '',
  }
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [entries, setEntries] = useState<WorkEntry[]>([])
  const [filtered, setFiltered] = useState<WorkEntry[]>([])
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notify, setNotify] = useState<{msg:string,type:'success'|'error'}|null>(null)
  const [selectedEntry, setSelectedEntry] = useState<WorkEntry | null>(null)
  const [filterMonth, setFilterMonth] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterWeek, setFilterWeek] = useState('All')

  /* edit form (single row) */
  const [form, setForm] = useState<Partial<WorkEntry>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'WIP', category: '', business_area: '', goals: '',
    task_details: '', time_taken: undefined, report_name: '', etl_job_name: '', comment: ''
  })

  /* multi-task add form */
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [taskRows, setTaskRows] = useState<TaskRow[]>([makeBlankRow()])

  useEffect(() => {
    const stored = localStorage.getItem('wr_user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    if (u.isManager) { router.push('/manager'); return }
    setUser(u)
  }, [router])

  const fetchEntries = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const res = await fetch(`/api/entries?email=${user.email}`)
    const data = await res.json()
    setEntries(data.entries || [])
    setLoading(false)
  }, [user])

  useEffect(() => { if (user) fetchEntries() }, [user, fetchEntries])

  useEffect(() => {
    let result = entries

    if (filterMonth !== 'All') {
      const mIdx = MONTHS.indexOf(filterMonth)
      result = result.filter(e => new Date(e.date).getMonth() + 1 === mIdx)
    }

    if (filterStatus !== 'All') {
      result = result.filter(e => e.status === filterStatus)
    }

    if (filterWeek === 'This Week') {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      result = result.filter(e => new Date(e.date) >= startOfWeek)
    } else if (filterWeek === 'Last Week') {
      const now = new Date()
      const startOfLastWeek = new Date(now)
      startOfLastWeek.setDate(now.getDate() - now.getDay() - 7)
      startOfLastWeek.setHours(0, 0, 0, 0)
      const endOfLastWeek = new Date(startOfLastWeek)
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6)
      endOfLastWeek.setHours(23, 59, 59, 999)
      result = result.filter(e => new Date(e.date) >= startOfLastWeek && new Date(e.date) <= endOfLastWeek)
    }

    setFiltered(result)
  }, [entries, filterMonth, filterStatus, filterWeek])

  function showNotify(msg: string, type: 'success'|'error') {
    setNotify({ msg, type })
    setTimeout(() => setNotify(null), 3000)
  }

  function exportToExcel(type: 'all' | 'monthly' | 'weekly') {
    const now = new Date()
    let exportData = entries
    if (type === 'monthly') {
      const month = now.getMonth(); const year = now.getFullYear()
      exportData = entries.filter(e => { const d = new Date(e.date); return d.getMonth() === month && d.getFullYear() === year })
    } else if (type === 'weekly') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
      exportData = entries.filter(e => new Date(e.date) >= weekAgo)
    }
    const data = exportData.map(e => ({
      Date: e.date, Category: e.category, 'Business Area': e.business_area,
      'Report Name': e.report_name, 'ETL Job': e.etl_job_name,
      'Task Details': e.task_details, 'Time Taken (hrs HH:M)': e.time_taken,
      Status: e.status, Goals: e.goals, Comment: e.comment,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Work Register')
    XLSX.writeFile(wb, `work-register-${type}-${format(now, 'yyyy-MM-dd')}.xlsx`)
  }

  /* ── Task row helpers ── */
  function updateRow(id: string, field: keyof TaskRow, value: string) {
    setTaskRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  function addRow() { setTaskRows(rows => [...rows, makeBlankRow()]) }
  function removeRow(id: string) { if (taskRows.length > 1) setTaskRows(rows => rows.filter(r => r.id !== id)) }

  /* ── Validate & submit multi-task ── */
  async function handleMultiSubmit() {
    for (const row of taskRows) {
      if (!row.category) return showNotify('Select category for all tasks', 'error')
      if (!row.business_area) return showNotify('Select business area for all tasks', 'error')
      if (!row.task_details.trim()) return showNotify('Task details required for all tasks', 'error')
      if (!row.time_taken || isNaN(Number(row.time_taken)) || Number(row.time_taken) <= 0)
        return showNotify('Valid hours required for all tasks', 'error')
      if (!row.goals) return showNotify('Select a goal for all tasks', 'error')
    }
    const totalHours = taskRows.reduce((sum, r) => sum + Number(r.time_taken), 0)
    if (totalHours < 7) return showNotify(`Total hours must be at least 7 (currently ${totalHours})`, 'error')

    setSaving(true)
    try {
      await Promise.all(taskRows.map(row =>
        fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_email: user!.email, employee_name: user!.name,
            date: entryDate, category: row.category, business_area: row.business_area,
            report_name: row.report_name, etl_job_name: row.etl_job_name,
            task_details: row.task_details, time_taken: Number(row.time_taken),
            status: row.status, goals: row.goals, comment: row.comment,
          }),
        })
      ))
      showNotify(`${taskRows.length} task(s) saved!`, 'success')
      setTaskRows([makeBlankRow()])
      setEntryDate(format(new Date(), 'yyyy-MM-dd'))
      setView('list')
      fetchEntries()
    } catch { showNotify('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  /* ── Edit submit (single row, unchanged logic) ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.task_details) return showNotify('Task details required', 'error')
    if (!form.time_taken) return showNotify('Time taken required', 'error')
    if (Number(form.time_taken) > 24) return showNotify('Time cannot exceed 24 hours', 'error')
    if (!form.goals) return showNotify('Please select a goal', 'error')
    setSaving(true)
    try {
      await fetch('/api/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedEntry!.id, ...form }),
      })
      showNotify('Entry updated!', 'success')
      await fetchEntries()
      setView('list')
      resetForm()
    } catch { showNotify('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/entries?id=${id}`, { method: 'DELETE' })
    showNotify('Entry deleted', 'success')
    fetchEntries()
  }

  function resetForm() {
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), status: 'WIP', category: '', business_area: '', goals: '', task_details: '', time_taken: undefined, report_name: '', etl_job_name: '', comment: '' })
    setSelectedEntry(null)
  }

  function handleEdit(entry: WorkEntry) {
    setSelectedEntry(entry)
    setForm({ ...entry })
    setView('edit')
  }

  function logout() { localStorage.removeItem('wr_user'); router.push('/login') }

  const totalEntryHours = taskRows.reduce((s, r) => s + (Number(r.time_taken) || 0), 0)

  if (!user) return null

  /* ══════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>

      {/* ── Topbar ── */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #dde3ec', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.5"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.5"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/></svg>
          </div>
          <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 600, fontSize: 15, color: '#1a2332' }}>Work Register</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#4a5568', fontSize: 13 }}>{user.name}</span>
          <button onClick={logout} style={{ background: 'white', border: '1px solid #dde3ec', color: '#4a5568', padding: '5px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* ── Notification ── */}
      {notify && (
        <div style={{ position: 'fixed', top: 68, right: 20, zIndex: 200,
          background: notify.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${notify.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: notify.type === 'success' ? '#15803d' : '#b91c1c',
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {notify.msg}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* ══════ LIST VIEW ══════ */}
        {view === 'list' && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>My Work Log</h1>
                <p style={{ color: '#8496a9', fontSize: 14, margin: 0 }}>{filtered.length} entries</p>
              </div>
              <button className="btn-primary" onClick={() => { setTaskRows([makeBlankRow()]); setEntryDate(format(new Date(), 'yyyy-MM-dd')); setView('add') }}>
                + Add Entry
              </button>
            </div>

            {/* Filters */}
            <div style={{ background: 'white', border: '1px solid #dde3ec', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#8496a9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Month</label>
                <select className="input-field" style={{ width: 140 }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#8496a9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                <select className="input-field" style={{ width: 130 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option>All</option><option>WIP</option><option>Complete</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#8496a9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Week</label>
                <select className="input-field" style={{ width: 140 }} value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
                  <option>All</option><option>This Week</option><option>Last Week</option>
                </select>
              </div>
              <div style={{ borderLeft: '1px solid #dde3ec', height: 36, marginLeft: 4 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#8496a9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Export</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => exportToExcel('all')} style={{ background: 'white', color: '#4a5568', border: '1px solid #dde3ec', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>↓ All</button>
                  <button onClick={() => exportToExcel('monthly')} style={{ background: 'white', color: '#4a5568', border: '1px solid #dde3ec', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>↓ Monthly</button>
                  <button onClick={() => exportToExcel('weekly')} style={{ background: 'white', color: '#4a5568', border: '1px solid #dde3ec', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>↓ Weekly</button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Total entries', value: filtered.length, color: '#1a2332' },
                { label: 'Completed', value: filtered.filter(e => e.status === 'Complete').length, color: '#15803d' },
                { label: 'In progress', value: filtered.filter(e => e.status === 'WIP').length, color: '#a16207' },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center', padding: '14px 20px' }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color, fontFamily: 'Syne,sans-serif' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#8496a9', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#8496a9' }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#8496a9' }}>No entries found. Add your first entry.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#eef2f8' }}>
                        {['Date','Category','Business Area','Task Details','Time (h)','Goals','Status',''].map(h => (
                          <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#4a5568', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #dde3ec' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry, i) => (
                        <tr key={entry.id}
                          style={{ borderBottom: '1px solid #dde3ec', background: i % 2 === 0 ? 'white' : '#f8fafc' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f1f5fb')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#f8fafc')}>
                          <td style={{ padding: '10px 16px', color: '#4a5568', whiteSpace: 'nowrap' }}>{entry.date}</td>
                          <td style={{ padding: '10px 16px', color: '#1a2332' }}>{entry.category}</td>
                          <td style={{ padding: '10px 16px', color: '#4a5568' }}>{entry.business_area}</td>
                          <td style={{ padding: '10px 16px', color: '#1a2332', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.task_details}</td>
                          <td style={{ padding: '10px 16px', color: '#1a2332', textAlign: 'center', fontWeight: 600 }}>{entry.time_taken}</td>
                          <td style={{ padding: '10px 16px', color: '#4a5568', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.goals}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span className={entry.status === 'Complete' ? 'badge-complete' : 'badge-wip'}>{entry.status}</span>
                          </td>
                          <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleEdit(entry)} style={{ background: 'white', border: '1px solid #dde3ec', color: '#4a5568', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', marginRight: 6 }}>Edit</button>
                            <button onClick={() => handleDelete(entry.id!)} style={{ background: 'white', border: '1px solid #fecaca', color: '#dc2626', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>Del</button>
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 700, color: '#1a2332', margin: '0 0 3px' }}>Add New Entry</h1>
                <p style={{ fontSize: 12, color: '#8496a9', margin: 0 }}>Add multiple tasks for the same day — total hours must be ≥ 7.</p>
              </div>
              <button className="btn-secondary" onClick={() => setView('list')}>← Back</button>
            </div>

            <div className="card">
              {/* Date + hours total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #dde3ec' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8496a9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Date *</label>
                  <input className="input-field" type="date" style={{ width: 180 }} value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <div style={{
                    background: totalEntryHours >= 7 ? '#dcfce7' : '#fef9c3',
                    color: totalEntryHours >= 7 ? '#15803d' : '#a16207',
                    border: `1px solid ${totalEntryHours >= 7 ? '#bbf7d0' : '#fde68a'}`,
                    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  }}>
                    Total: {totalEntryHours}h {totalEntryHours >= 7 ? '✓' : `(need ${(7 - totalEntryHours).toFixed(1)} more)`}
                  </div>
                </div>
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr 0.8fr 1.4fr 0.5fr 0.7fr 1fr 0.7fr 32px', gap: 8, padding: '0 4px', marginBottom: 6 }}>
                {['Category *','Business Area *','Report Name','ETL Job','Task Details *','Hours *','Status','Goals *','Comment',''].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#8496a9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                ))}
              </div>

              {/* Task rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {taskRows.map((row, idx) => (
                  <div key={row.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 0.8fr 0.8fr 1.4fr 0.5fr 0.7fr 1fr 0.7fr 32px',
                    gap: 8, alignItems: 'start',
                    background: idx % 2 === 0 ? 'white' : '#f8fafc',
                    padding: 8, borderRadius: 8, border: '1px solid #dde3ec',
                  }}>
                    <select className="input-field" value={row.category} onChange={e => updateRow(row.id, 'category', e.target.value)}>
                      <option value="">Select…</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <select className="input-field" value={row.business_area} onChange={e => updateRow(row.id, 'business_area', e.target.value)}>
                      <option value="">Select…</option>
                      {BUSINESS_AREAS.map(b => <option key={b}>{b}</option>)}
                    </select>
                    <input className="input-field" type="text" placeholder="Optional" value={row.report_name} onChange={e => updateRow(row.id, 'report_name', e.target.value)} />
                    <input className="input-field" type="text" placeholder="Optional" value={row.etl_job_name} onChange={e => updateRow(row.id, 'etl_job_name', e.target.value)} />
                    <input className="input-field" type="text" placeholder="Describe task…" value={row.task_details} onChange={e => updateRow(row.id, 'task_details', e.target.value)} />
                    <input className="input-field" type="number" placeholder="hrs" min="0.5" max="24" step="0.5" value={row.time_taken} onChange={e => updateRow(row.id, 'time_taken', e.target.value)} />
                    <select className="input-field" value={row.status} onChange={e => updateRow(row.id, 'status', e.target.value as 'Complete'|'WIP')}>
                      <option>WIP</option><option>Complete</option>
                    </select>
                    <select className="input-field" value={row.goals} onChange={e => updateRow(row.id, 'goals', e.target.value)}>
                      <option value="">Select…</option>
                      {GOALS.map(g => <option key={g}>{g}</option>)}
                    </select>
                    <input className="input-field" type="text" placeholder="Optional" value={row.comment} onChange={e => updateRow(row.id, 'comment', e.target.value)} />
                    <button onClick={() => removeRow(row.id)} disabled={taskRows.length === 1}
                      style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${taskRows.length === 1 ? '#dde3ec' : '#fecaca'}`, background: taskRows.length === 1 ? '#f8f8f8' : '#fef2f2', color: taskRows.length === 1 ? '#aaa' : '#dc2626', cursor: taskRows.length === 1 ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid #dde3ec' }}>
                <button className="btn-secondary" onClick={addRow} style={{ fontSize: 13 }}>+ Add Another Task</button>
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
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => { setView('list'); resetForm() }} style={{ background: 'transparent', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>←</button>
              <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 20, fontWeight: 700, color: '#1a2332', margin: 0 }}>Edit Entry</h1>
            </div>
            <div className="card">
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Date *</label>
                    <input className="input-field" type="date" value={form.date || ''} onChange={e => setForm(f => ({...f, date: e.target.value}))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Status *</label>
                    <select className="input-field" value={form.status || 'WIP'} onChange={e => setForm(f => ({...f, status: e.target.value as 'Complete'|'WIP'}))}>
                      <option>WIP</option><option>Complete</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Category *</label>
                    <select className="input-field" value={form.category || ''} onChange={e => setForm(f => ({...f, category: e.target.value}))} required>
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Business Area *</label>
                    <select className="input-field" value={form.business_area || ''} onChange={e => setForm(f => ({...f, business_area: e.target.value}))} required>
                      <option value="">Select area</option>
                      {BUSINESS_AREAS.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Report Name (Power BI)</label>
                    <input className="input-field" type="text" value={form.report_name || ''} onChange={e => setForm(f => ({...f, report_name: e.target.value}))} placeholder="Optional" />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>ETL Job Name</label>
                    <input className="input-field" type="text" value={form.etl_job_name || ''} onChange={e => setForm(f => ({...f, etl_job_name: e.target.value}))} placeholder="Optional" />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Task Details *</label>
                    <textarea className="input-field" value={form.task_details || ''} onChange={e => setForm(f => ({...f, task_details: e.target.value}))} required rows={3} style={{ resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Time Taken (hours) *</label>
                    <input className="input-field" type="number" min="0.5" max="24" step="0.5" value={form.time_taken || ''} onChange={e => setForm(f => ({...f, time_taken: Number(e.target.value)}))} required placeholder="0–24" />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Goals *</label>
                    <select className="input-field" value={form.goals || ''} onChange={e => setForm(f => ({...f, goals: e.target.value}))} required>
                      <option value="">Select goal</option>
                      {GOALS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Comment</label>
                    <input className="input-field" type="text" value={form.comment || ''} onChange={e => setForm(f => ({...f, comment: e.target.value}))} placeholder="Optional" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => { setView('list'); resetForm() }}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Update Entry'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}