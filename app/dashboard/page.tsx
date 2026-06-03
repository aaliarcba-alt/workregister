'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GOALS, CATEGORIES, BUSINESS_AREAS, WorkEntry } from '@/lib/supabase'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

type User = { id: string; name: string; email: string; designation: string; isManager: boolean }

const MONTHS = ['All','January','February','March','April','May','June','July','August','September','October','November','December']

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
  const [form, setForm] = useState<Partial<WorkEntry>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'WIP', category: '', business_area: '', goals: '',
    task_details: '', time_taken: undefined, report_name: '', etl_job_name: '', comment: ''
  })

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
    if (filterMonth === 'All') { setFiltered(entries); return }
    const mIdx = MONTHS.indexOf(filterMonth)
    setFiltered(entries.filter(e => new Date(e.date).getMonth() + 1 === mIdx))
  }, [entries, filterMonth])

  function showNotify(msg: string, type: 'success'|'error') {
    setNotify({ msg, type })
    setTimeout(() => setNotify(null), 3000)
  }

  function exportToExcel(type: 'all' | 'monthly' | 'weekly') {
    const now = new Date()
    let exportData = entries

    if (type === 'monthly') {
      const month = now.getMonth()
      const year = now.getFullYear()
      exportData = entries.filter(e => {
        const d = new Date(e.date)
        return d.getMonth() === month && d.getFullYear() === year
      })
    } else if (type === 'weekly') {
      const weekAgo = new Date(now)
      weekAgo.setDate(now.getDate() - 7)
      exportData = entries.filter(e => new Date(e.date) >= weekAgo)
    }

    const data = exportData.map(e => ({
      Date: e.date,
      Category: e.category,
      'Business Area': e.business_area,
      'Report Name': e.report_name,
      'ETL Job': e.etl_job_name,
      'Task Details': e.task_details,
      'Time Taken (hrs HH:M)': e.time_taken,
      Status: e.status,
      Goals: e.goals,
      Comment: e.comment,
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Work Register')
    XLSX.writeFile(wb, `work-register-${type}-${format(now, 'yyyy-MM-dd')}.xlsx`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.task_details) return showNotify('Task details required', 'error')
    if (!form.time_taken) return showNotify('Time taken required', 'error')
    if (Number(form.time_taken) > 9) return showNotify('Time cannot exceed 9 hours', 'error')
    if (!form.goals) return showNotify('Please select a goal', 'error')
    setSaving(true)
    try {
      if (view === 'edit' && selectedEntry?.id) {
        await fetch('/api/entries', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedEntry.id, ...form }),
        })
        showNotify('Entry updated!', 'success')
      } else {
        await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, employee_email: user!.email, employee_name: user!.name }),
        })
        showNotify('Entry added!', 'success')
      }
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

  function logout() {
    localStorage.removeItem('wr_user')
    router.push('/login')
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#060d18' }}>
      {/* Topbar */}
      <div style={{ background: '#0d1b2e', borderBottom: '1px solid #162d47', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#3872c8,#1e3d5c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.5"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.5"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/></svg>
          </div>
          <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 600, fontSize: 15, color: '#e8edf5' }}>Work Register</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#4a6380', fontSize: 13 }}>{user.name}</span>
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #162d47', color: '#4a6380', padding: '5px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Notification */}
      {notify && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100, background: notify.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${notify.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: notify.type === 'success' ? '#4ade80' : '#f87171', padding: '10px 18px', borderRadius: 8, fontSize: 14 }}>
          {notify.msg}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        {view === 'list' ? (
          <>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 700, color: '#e8edf5', margin: '0 0 4px' }}>My Work Log</h1>
                <p style={{ color: '#4a6380', fontSize: 14, margin: 0 }}>{filtered.length} entries</p>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select className="input-field" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
                <button className="btn-primary" onClick={() => { resetForm(); setView('add') }}>+ Add Entry</button>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total entries', value: filtered.length, color: '#e8edf5' },
                { label: 'Completed', value: filtered.filter(e => e.status === 'Complete').length, color: '#4ade80' },
                { label: 'In progress', value: filtered.filter(e => e.status === 'WIP').length, color: '#fbbf24' },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: 'Syne,sans-serif' }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: '#4a6380', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Export buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => exportToExcel('all')} style={{ background: '#0d1b2e', color: '#8ba3c4', border: '1px solid #162d47', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                ↓ Export All
              </button>
              <button onClick={() => exportToExcel('monthly')} style={{ background: '#0d1b2e', color: '#8ba3c4', border: '1px solid #162d47', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                ↓ Export This Month
              </button>
              <button onClick={() => exportToExcel('weekly')} style={{ background: '#0d1b2e', color: '#8ba3c4', border: '1px solid #162d47', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                ↓ Export This Week
              </button>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#4a6380' }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#4a6380' }}>No entries found. Add your first entry.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #162d47' }}>
                        {['Date','Category','Business Area','Task Details','Time (HH:M)','Goals','Status',''].map(h => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#4a6380', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(entry => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #0d1b2e' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#0d1b2e')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '11px 16px', color: '#8ba3c4', whiteSpace: 'nowrap' }}>{entry.date}</td>
                          <td style={{ padding: '11px 16px', color: '#e8edf5' }}>{entry.category}</td>
                          <td style={{ padding: '11px 16px', color: '#8ba3c4' }}>{entry.business_area}</td>
                          <td style={{ padding: '11px 16px', color: '#e8edf5', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.task_details}</td>
                          <td style={{ padding: '11px 16px', color: '#e8edf5', textAlign: 'center' }}>{entry.time_taken}</td>
                          <td style={{ padding: '11px 16px', color: '#8ba3c4', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.goals}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <span className={entry.status === 'Complete' ? 'badge-complete' : 'badge-wip'}>{entry.status}</span>
                          </td>
                          <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleEdit(entry)} style={{ background: 'transparent', border: '1px solid #1e3d5c', color: '#8ba3c4', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', marginRight: 6 }}>Edit</button>
                            <button onClick={() => handleDelete(entry.id!)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>Del</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Add/Edit Form */
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button onClick={() => { setView('list'); resetForm() }} style={{ background: 'transparent', border: 'none', color: '#4a6380', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>←</button>
              <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 700, color: '#e8edf5', margin: 0 }}>
                {view === 'edit' ? 'Edit Entry' : 'Add New Entry'}
              </h1>
            </div>
            <div className="card">
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Date *</label>
                    <input className="input-field" type="date" value={form.date || ''} onChange={e => setForm(f => ({...f, date: e.target.value}))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Status *</label>
                    <select className="input-field" value={form.status || 'WIP'} onChange={e => setForm(f => ({...f, status: e.target.value as 'Complete'|'WIP'}))}>
                      <option>WIP</option><option>Complete</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Category *</label>
                    <select className="input-field" value={form.category || ''} onChange={e => setForm(f => ({...f, category: e.target.value}))} required>
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Business Area *</label>
                    <select className="input-field" value={form.business_area || ''} onChange={e => setForm(f => ({...f, business_area: e.target.value}))} required>
                      <option value="">Select area</option>
                      {BUSINESS_AREAS.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Report Name (Power BI)</label>
                    <input className="input-field" type="text" value={form.report_name || ''} onChange={e => setForm(f => ({...f, report_name: e.target.value}))} placeholder="Optional" />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>ETL Job Name</label>
                    <input className="input-field" type="text" value={form.etl_job_name || ''} onChange={e => setForm(f => ({...f, etl_job_name: e.target.value}))} placeholder="Optional" />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Task Details *</label>
                    <textarea className="input-field" value={form.task_details || ''} onChange={e => setForm(f => ({...f, task_details: e.target.value}))} required rows={3} style={{ resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Time Taken (hours) *</label>
                    <input className="input-field" type="number" min="0.5" max="9" step="0.5" value={form.time_taken || ''} onChange={e => setForm(f => ({...f, time_taken: Number(e.target.value)}))} required placeholder="0–9" />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Goals *</label>
                    <select className="input-field" value={form.goals || ''} onChange={e => setForm(f => ({...f, goals: e.target.value}))} required>
                      <option value="">Select goal</option>
                      {GOALS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', color: '#8ba3c4', fontSize: 13, marginBottom: 6 }}>Comment</label>
                    <input className="input-field" type="text" value={form.comment || ''} onChange={e => setForm(f => ({...f, comment: e.target.value}))} placeholder="Optional" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => { setView('list'); resetForm() }}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : view === 'edit' ? 'Update Entry' : 'Submit Entry'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}