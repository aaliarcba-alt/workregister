'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type User = { name: string; email: string; isManager: boolean; isAdmin: boolean }
type EmployeeRow = { id: string; name: string; email: string; designation: string; created_at?: string }

const DESIGNATIONS = ['employee', 'cdo', 'admin']

function makeBlankForm() {
  return { name: '', email: '', password: '', designation: 'employee' }
}

export default function AdminPanel() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(makeBlankForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ name: string; designation: string; password: string }>({ name: '', designation: '', password: '' })
  const [notify, setNotify] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('wr_user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    if (!u.isAdmin) { router.push(u.isManager ? '/manager' : '/dashboard'); return }
    setUser(u)
  }, [router])

  const fetchEmployees = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const res = await fetch(`/api/admin/users?requester_email=${encodeURIComponent(user.email)}`)
    const data = await res.json()
    setEmployees(data.employees || [])
    setLoading(false)
  }, [user])

  useEffect(() => { if (user) fetchEmployees() }, [user, fetchEmployees])

  function showNotify(msg: string, type: 'success' | 'error') {
    setNotify({ msg, type })
    setTimeout(() => setNotify(null), 3000)
  }

  function logout() { localStorage.removeItem('wr_user'); router.push('/login') }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      return showNotify('Name, email, and password are required', 'error')
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_email: user!.email, ...form }),
      })
      const data = await res.json()
      if (!res.ok) { showNotify(data.error || 'Failed to add user', 'error'); return }
      showNotify(`${form.name} added!`, 'success')
      setForm(makeBlankForm())
      setShowAddForm(false)
      fetchEmployees()
    } catch {
      showNotify('Failed to add user', 'error')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(emp: EmployeeRow) {
    setEditingId(emp.id)
    setEditValues({ name: emp.name, designation: emp.designation, password: '' })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    try {
      const body: Record<string, string> = { requester_email: user!.email, id, name: editValues.name, designation: editValues.designation }
      if (editValues.password.trim()) body.password = editValues.password.trim()
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { showNotify(data.error || 'Failed to update user', 'error'); return }
      showNotify('User updated!', 'success')
      setEditingId(null)
      fetchEmployees()
    } catch {
      showNotify('Failed to update user', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(emp: EmployeeRow) {
    if (emp.email === user!.email) return showNotify("You can't delete your own account", 'error')
    if (!confirm(`Remove ${emp.name}? Their existing entries will remain but they won't be able to log in.`)) return
    const res = await fetch(`/api/admin/users?id=${emp.id}&requester_email=${encodeURIComponent(user!.email)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { showNotify(data.error || 'Failed to delete user', 'error'); return }
    showNotify('User removed', 'success')
    fetchEmployees()
  }

  if (!user) return null

  const notifyColors = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>
      {/* Topbar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #dde3ec', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.5"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.5"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/></svg>
          </div>
          <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 600, fontSize: 15, color: '#1a2332' }}>Work Register</span>
          <span style={{ background: '#eef2ff', color: '#4338ca', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, border: '1px solid #c7d2fe' }}>Admin Panel</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.push(user.isManager ? '/manager' : '/dashboard')} style={{ background: 'white', border: '1px solid #dde3ec', color: '#4a5568', padding: '5px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>← Back</button>
          <span style={{ color: '#4a5568', fontSize: 13 }}>{user.name}</span>
          <button onClick={logout} style={{ background: 'white', border: '1px solid #dde3ec', color: '#4a5568', padding: '5px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {notify && (() => {
        const c = notifyColors[notify.type]
        return (
          <div style={{ position: 'fixed', top: 68, right: 20, zIndex: 200, background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {notify.msg}
          </div>
        )
      })()}

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 22, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>User Management</h1>
            <p style={{ color: '#8496a9', fontSize: 14, margin: 0 }}>{employees.length} users</p>
          </div>
          <button className="btn-primary" onClick={() => setShowAddForm(s => !s)}>
            {showAddForm ? 'Cancel' : '+ Add User'}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddUser} className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Full Name *</label>
                <input className="input-field" type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Email *</label>
                <input className="input-field" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="name@welspun.com" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Temporary Password *</label>
                <input className="input-field" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              </div>
              <div>
                <label style={{ display: 'block', color: '#4a5568', fontSize: 13, marginBottom: 6 }}>Role *</label>
                <select className="input-field" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d === 'cdo' ? 'Manager (CDO)' : d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => { setShowAddForm(false); setForm(makeBlankForm()) }}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add User'}</button>
            </div>
          </form>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8496a9' }}>Loading...</div>
          ) : employees.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8496a9' }}>No users found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#eef2f8' }}>
                  {['Name', 'Email', 'Role', 'Reset Password', ''].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#4a5568', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #dde3ec' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const isEditing = editingId === emp.id
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid #dde3ec', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '10px 16px', color: '#1a2332' }}>
                        {isEditing ? (
                          <input className="input-field" style={{ fontSize: 13 }} value={editValues.name} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} />
                        ) : emp.name}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#4a5568' }}>{emp.email}</td>
                      <td style={{ padding: '10px 16px' }}>
                        {isEditing ? (
                          <select className="input-field" style={{ fontSize: 13 }} value={editValues.designation} onChange={e => setEditValues(v => ({ ...v, designation: e.target.value }))}>
                            {DESIGNATIONS.map(d => <option key={d} value={d}>{d === 'cdo' ? 'Manager (CDO)' : d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                          </select>
                        ) : (
                          <span style={{
                            background: emp.designation === 'admin' ? '#eef2ff' : emp.designation === 'cdo' ? '#eff6ff' : '#f1f5f9',
                            color: emp.designation === 'admin' ? '#4338ca' : emp.designation === 'cdo' ? '#2563eb' : '#4a5568',
                            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          }}>
                            {emp.designation === 'cdo' ? 'Manager' : emp.designation.charAt(0).toUpperCase() + emp.designation.slice(1)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {isEditing ? (
                          <input className="input-field" style={{ fontSize: 13 }} placeholder="Leave blank to keep" value={editValues.password} onChange={e => setEditValues(v => ({ ...v, password: e.target.value }))} />
                        ) : (
                          <span style={{ color: '#c3cbd6' }}>••••••••</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(emp.id)} disabled={saving} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', marginRight: 6 }}>Save</button>
                            <button onClick={() => setEditingId(null)} style={{ background: 'white', border: '1px solid #dde3ec', color: '#4a5568', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(emp)} style={{ background: 'white', border: '1px solid #dde3ec', color: '#4a5568', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', marginRight: 6 }}>Edit</button>
                            <button onClick={() => handleDelete(emp)} style={{ background: 'white', border: '1px solid #fecaca', color: '#dc2626', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>Remove</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
