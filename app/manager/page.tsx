'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { WorkEntry, EMPLOYEES as FALLBACK_EMPLOYEES } from '@/lib/supabase'

type User = { name: string; email: string; isManager: boolean; isAdmin: boolean }

const MONTHS = [
  { label: 'All', value: 'all' },
  { label: 'January', value: '1' }, { label: 'February', value: '2' },
  { label: 'March', value: '3' }, { label: 'April', value: '4' },
  { label: 'May', value: '5' }, { label: 'June', value: '6' },
  { label: 'July', value: '7' }, { label: 'August', value: '8' },
  { label: 'September', value: '9' }, { label: 'October', value: '10' },
  { label: 'November', value: '11' }, { label: 'December', value: '12' },
]

const CHART_COLORS = { complete: '#15803d', wip: '#a16207' }
const CHART_FILL   = { complete: '#22c55e', wip: '#eab308' }

export default function ManagerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [entries, setEntries] = useState<WorkEntry[]>([])
  const [month, setMonth] = useState('all')
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview'|'team'|'goals'>('overview')
  const [employees, setEmployees] = useState(FALLBACK_EMPLOYEES)

  useEffect(() => {
    const stored = localStorage.getItem('wr_user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    if (!u.isManager) { router.push('/dashboard'); return }
    setUser(u)
  }, [router])

  // Pull the live employee list so newly-added users (via Admin panel) show up
  // in filters without needing a redeploy.
  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => { if (data.employees?.length) setEmployees(data.employees) })
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/manager?month=${month}&year=2026`)
    const data = await res.json()
    setEntries(data.entries || [])
    setLoading(false)
  }, [month])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  function logout() { localStorage.removeItem('wr_user'); router.push('/login') }

  const filteredEntries = selectedEmployee === 'all'
    ? entries
    : entries.filter(e => e.employee_email === selectedEmployee)

  const total = filteredEntries.length
  const completed = filteredEntries.filter(e => e.status === 'Complete').length
  const wip = filteredEntries.filter(e => e.status === 'WIP').length
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0
  const empCount = selectedEmployee === 'all' ? employees.length : 1

  const employeeMap: Record<string, { name: string; complete: number; wip: number }> = {}
  filteredEntries.forEach(e => {
    const key = e.employee_name
    if (!employeeMap[key]) employeeMap[key] = { name: key.split(' ')[0], complete: 0, wip: 0 }
    if (e.status === 'Complete') employeeMap[key].complete++
    else employeeMap[key].wip++
  })
  const employeeData = Object.values(employeeMap)

  const goalsMap: Record<string, number> = {}
  filteredEntries.forEach(e => { goalsMap[e.goals] = (goalsMap[e.goals] || 0) + 1 })
  const goalsData = Object.entries(goalsMap).map(([name, count]) => ({
    name: name.length > 30 ? name.substring(0, 28) + '…' : name, count
  })).sort((a, b) => b.count - a.count)

  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const m = d.getMonth() + 1
    const label = d.toLocaleString('default', { month: 'short' })
    const monthEntries = filteredEntries.filter(e => new Date(e.date).getMonth() + 1 === m)
    return { month: label, complete: monthEntries.filter(e => e.status === 'Complete').length, wip: monthEntries.filter(e => e.status === 'WIP').length }
  })

  // Light theme tooltip style
  const tooltipStyle = { background: '#ffffff', border: '1px solid #dde3ec', borderRadius: 8, fontSize: 12, color: '#1a2332', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }

  if (!user) return null

  const selectedEmpName = selectedEmployee === 'all'
    ? 'All employees'
    : employees.find(e => e.email === selectedEmployee)?.name || selectedEmployee

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>

      {/* Topbar — matches dashboard exactly */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #dde3ec', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.5"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.5"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/></svg>
          </div>
          <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 600, fontSize: 15, color: '#1a2332' }}>Work Register</span>
          <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, border: '1px solid #bfdbfe' }}>Manager View</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user.isAdmin && (
            <button onClick={() => router.push('/admin')} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', padding: '5px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>⚙ Admin</button>
          )}
          <span style={{ color: '#4a5568', fontSize: 13 }}>{user.name}</span>
          <button onClick={logout} style={{ background: 'white', border: '1px solid #dde3ec', color: '#4a5568', padding: '5px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* Page header + filters */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 700, color: '#1a2332', margin: '0 0 4px' }}>Team Dashboard</h1>
            <p style={{ color: '#8496a9', fontSize: 14, margin: 0 }}>
              {selectedEmployee === 'all' ? `Sintex Digital Team — ${employees.length} members` : `Viewing: ${selectedEmpName}`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#8496a9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Employee</label>
              <select
                className="input-field"
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                style={{ width: 'auto', minWidth: 160 }}
              >
                <option value="all">All employees</option>
                {employees.map(emp => (
                  <option key={emp.email} value={emp.email}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#8496a9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Month</label>
              <select
                className="input-field"
                value={month}
                onChange={e => setMonth(e.target.value)}
                style={{ width: 'auto' }}
              >
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {(selectedEmployee !== 'all' || month !== 'all') && (
              <button
                onClick={() => { setSelectedEmployee('all'); setMonth('all') }}
                className="btn-secondary"
                style={{ fontSize: 13 }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Active filter pill */}
        {selectedEmployee !== 'all' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 12px', borderRadius: 20, fontSize: 12 }}>
              <span>👤 {selectedEmpName}</span>
              <button onClick={() => setSelectedEmployee('all')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 4 }}>×</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#8496a9' }}>Loading team data...</div>
        ) : (
          <>
            {/* Metric cards — light theme */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Total tasks',  value: total,                              color: '#1a2332', sub: selectedEmployee === 'all' ? 'all entries' : selectedEmpName.split(' ')[0] },
                { label: 'Completed',    value: completed,                          color: '#15803d', sub: `${completionPct}% rate` },
                { label: 'In progress',  value: wip,                                color: '#a16207', sub: 'WIP tasks' },
                { label: 'Avg / person', value: Math.round(total / (empCount || 1)), color: '#2563eb', sub: empCount === 1 ? 'individual' : `${empCount} employees` },
              ].map(m => (
                <div key={m.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: m.color, fontFamily: 'Syne,sans-serif' }}>{m.value}</div>
                  <div style={{ fontSize: 13, color: '#4a5568', margin: '4px 0 2px' }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: '#8496a9' }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #dde3ec', marginBottom: 24 }}>
              {(['overview','team','goals'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  background: 'transparent', border: 'none', padding: '10px 20px',
                  color: activeTab === t ? '#2563eb' : '#8496a9', cursor: 'pointer', fontSize: 14,
                  borderBottom: activeTab === t ? '2px solid #2563eb' : '2px solid transparent',
                  fontFamily: 'inherit', textTransform: 'capitalize', fontWeight: activeTab === t ? 600 : 400,
                }}>{t}</button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="card">
                  <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 600, color: '#4a5568', margin: '0 0 16px' }}>
                    {selectedEmployee === 'all' ? 'Tasks by employee' : `Tasks — ${selectedEmpName.split(' ')[0]}`}
                  </h3>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                    {[{c: CHART_FILL.complete, l:'Complete'},{c: CHART_FILL.wip, l:'WIP'}].map(x => (
                      <div key={x.l} style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#8496a9' }}>
                        <div style={{width:10,height:10,borderRadius:2,background:x.c}}/>{x.l}
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={employeeData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" vertical={false}/>
                      <XAxis dataKey="name" tick={{ fill: '#8496a9', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: '#8496a9', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(37,99,235,0.05)' }}/>
                      <Bar dataKey="complete" name="Complete" fill={CHART_FILL.complete} radius={[3,3,0,0]} stackId="a"/>
                      <Bar dataKey="wip" name="WIP" fill={CHART_FILL.wip} radius={[3,3,0,0]} stackId="a"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 600, color: '#4a5568', margin: '0 0 16px' }}>Monthly trend</h3>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                    {[{c: CHART_FILL.complete, l:'Complete'},{c: CHART_FILL.wip, l:'WIP'}].map(x => (
                      <div key={x.l} style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#8496a9' }}>
                        <div style={{width:10,height:10,borderRadius:2,background:x.c}}/>{x.l}
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" vertical={false}/>
                      <XAxis dataKey="month" tick={{ fill: '#8496a9', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: '#8496a9', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Line type="monotone" dataKey="complete" name="Complete" stroke={CHART_FILL.complete} strokeWidth={2} dot={{ r: 3, fill: CHART_FILL.complete }}/>
                      <Line type="monotone" dataKey="wip" name="WIP" stroke={CHART_FILL.wip} strokeWidth={2} dot={{ r: 3, fill: CHART_FILL.wip }} strokeDasharray="4 3"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#eef2f8' }}>
                      {['Employee','Total tasks','Completed','In progress','Completion %','Status'].map(h => (
                        <th key={h} style={{ padding: '11px 20px', textAlign: 'left', color: '#4a5568', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #dde3ec' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employeeData.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#8496a9' }}>No data for selected filters</td></tr>
                    ) : employeeData.map((emp, i) => {
                      const t = emp.complete + emp.wip
                      const pct = t > 0 ? Math.round((emp.complete / t) * 100) : 0
                      return (
                        <tr key={emp.name}
                          style={{ borderBottom: '1px solid #dde3ec', background: i % 2 === 0 ? 'white' : '#f8fafc' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f1f5fb')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#f8fafc')}>
                          <td style={{ padding: '12px 20px', color: '#1a2332', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#2563eb', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                                {emp.name.charAt(0)}
                              </div>
                              {emp.name}
                            </div>
                          </td>
                          <td style={{ padding: '12px 20px', color: '#1a2332' }}>{t}</td>
                          <td style={{ padding: '12px 20px', color: '#15803d', fontWeight: 600 }}>{emp.complete}</td>
                          <td style={{ padding: '12px 20px', color: '#a16207', fontWeight: 600 }}>{emp.wip}</td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 2, maxWidth: 80 }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: pct >= 75 ? '#22c55e' : '#eab308', borderRadius: 2 }}/>
                              </div>
                              <span style={{ color: '#4a5568', fontSize: 12 }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{
                              background: pct >= 75 ? '#dcfce7' : '#fef9c3',
                              color: pct >= 75 ? '#15803d' : '#a16207',
                              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                              border: `1px solid ${pct >= 75 ? '#bbf7d0' : '#fde68a'}`
                            }}>
                              {pct >= 75 ? 'On track' : 'Needs attention'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'goals' && (
              <div className="card">
                <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 600, color: '#4a5568', margin: '0 0 20px' }}>
                  Tasks by goal category{selectedEmployee !== 'all' ? ` — ${selectedEmpName}` : ''}
                </h3>
                {goalsData.length === 0 ? (
                  <p style={{ color: '#8496a9', textAlign: 'center', padding: 32 }}>No data for selected filters</p>
                ) : goalsData.map((g, i) => {
                  const maxCount = goalsData[0].count
                  const pct = Math.round((g.count / maxCount) * 100)
                  const colors = ['#2563eb','#22c55e','#eab308','#f87171','#a78bfa','#34d399','#fb923c','#60a5fa']
                  return (
                    <div key={g.name} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#1a2332' }}>{g.name}</span>
                        <span style={{ fontSize: 13, color: '#8496a9' }}>{g.count} tasks</span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: colors[i % colors.length], borderRadius: 3, transition: 'width 0.5s ease' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}