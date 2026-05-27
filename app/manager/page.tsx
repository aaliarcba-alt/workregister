'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { WorkEntry } from '@/lib/supabase'

type User = { name: string; email: string; isManager: boolean }

const MONTHS = [
  { label: 'All', value: 'all' },
  { label: 'January', value: '1' }, { label: 'February', value: '2' },
  { label: 'March', value: '3' }, { label: 'April', value: '4' },
  { label: 'May', value: '5' }, { label: 'June', value: '6' },
  { label: 'July', value: '7' }, { label: 'August', value: '8' },
  { label: 'September', value: '9' }, { label: 'October', value: '10' },
  { label: 'November', value: '11' }, { label: 'December', value: '12' },
]

const CHART_COLORS = { complete: '#4ade80', wip: '#fbbf24', line: '#3872c8' }

export default function ManagerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [entries, setEntries] = useState<WorkEntry[]>([])
  const [month, setMonth] = useState('all')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview'|'team'|'goals'>('overview')

  useEffect(() => {
    const stored = localStorage.getItem('wr_user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    if (!u.isManager) { router.push('/dashboard'); return }
    setUser(u)
  }, [router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/manager?month=${month}&year=2026`)
    const data = await res.json()
    setEntries(data.entries || [])
    setLoading(false)
  }, [month])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  function logout() { localStorage.removeItem('wr_user'); router.push('/login') }

  // Derived stats
  const total = entries.length
  const completed = entries.filter(e => e.status === 'Complete').length
  const wip = entries.filter(e => e.status === 'WIP').length
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0

  // Per-employee data
  const employeeMap: Record<string, { name: string; complete: number; wip: number }> = {}
  entries.forEach(e => {
    const key = e.employee_name
    if (!employeeMap[key]) employeeMap[key] = { name: key.split(' ')[0], complete: 0, wip: 0 }
    if (e.status === 'Complete') employeeMap[key].complete++
    else employeeMap[key].wip++
  })
  const employeeData = Object.values(employeeMap)

  // Goals breakdown
  const goalsMap: Record<string, number> = {}
  entries.forEach(e => { goalsMap[e.goals] = (goalsMap[e.goals] || 0) + 1 })
  const goalsData = Object.entries(goalsMap).map(([name, count]) => ({
    name: name.length > 30 ? name.substring(0, 28) + '…' : name, count
  })).sort((a, b) => b.count - a.count)

  // Monthly trend (last 6 months)
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const m = d.getMonth() + 1
    const label = d.toLocaleString('default', { month: 'short' })
    const monthEntries = entries.filter(e => new Date(e.date).getMonth() + 1 === m)
    return { month: label, complete: monthEntries.filter(e => e.status === 'Complete').length, wip: monthEntries.filter(e => e.status === 'WIP').length }
  })

  const tooltipStyle = { background: '#0d1b2e', border: '1px solid #162d47', borderRadius: 8, fontSize: 12, color: '#e8edf5' }

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
          <span style={{ background: 'rgba(56,114,200,0.15)', color: '#3872c8', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>Manager View</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#4a6380', fontSize: 13 }}>{user.name}</span>
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #162d47', color: '#4a6380', padding: '5px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>
        {/* Page header + filter */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 700, color: '#e8edf5', margin: '0 0 4px' }}>Team Dashboard</h1>
            <p style={{ color: '#4a6380', fontSize: 14, margin: 0 }}>Sintex Digital Team — 9 members</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ color: '#4a6380', fontSize: 13 }}>Month:</label>
            <select className="input-field" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 'auto', padding: '8px 12px' }}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#4a6380' }}>Loading team data...</div>
        ) : (
          <>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Total tasks', value: total, color: '#e8edf5', sub: 'all entries' },
                { label: 'Completed', value: completed, color: '#4ade80', sub: `${completionPct}% rate` },
                { label: 'In progress', value: wip, color: '#fbbf24', sub: 'WIP tasks' },
                { label: 'Avg / person', value: Math.round(total / 9), color: '#3872c8', sub: '9 employees' },
              ].map(m => (
                <div key={m.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: m.color, fontFamily: 'Syne,sans-serif' }}>{m.value}</div>
                  <div style={{ fontSize: 13, color: '#8ba3c4', margin: '4px 0 2px' }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: '#4a6380' }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #162d47', marginBottom: 24 }}>
              {(['overview','team','goals'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  background: 'transparent', border: 'none', padding: '10px 20px',
                  color: activeTab === t ? '#e8edf5' : '#4a6380', cursor: 'pointer', fontSize: 14,
                  borderBottom: activeTab === t ? '2px solid #3872c8' : '2px solid transparent',
                  fontFamily: 'inherit', textTransform: 'capitalize',
                }}>{t}</button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Bar chart */}
                <div className="card">
                  <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 600, color: '#8ba3c4', margin: '0 0 16px' }}>Tasks by employee</h3>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                    {[{c: CHART_COLORS.complete, l:'Complete'},{c: CHART_COLORS.wip, l:'WIP'}].map(x => (
                      <div key={x.l} style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#4a6380' }}>
                        <div style={{width:10,height:10,borderRadius:2,background:x.c}}/>
                        {x.l}
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={employeeData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#162d47" vertical={false}/>
                      <XAxis dataKey="name" tick={{ fill: '#4a6380', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: '#4a6380', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(56,114,200,0.05)' }}/>
                      <Bar dataKey="complete" name="Complete" fill={CHART_COLORS.complete} radius={[3,3,0,0]} stackId="a"/>
                      <Bar dataKey="wip" name="WIP" fill={CHART_COLORS.wip} radius={[3,3,0,0]} stackId="a"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Line chart */}
                <div className="card">
                  <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 600, color: '#8ba3c4', margin: '0 0 16px' }}>Monthly trend</h3>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                    {[{c: CHART_COLORS.complete, l:'Complete'},{c: CHART_COLORS.wip, l:'WIP'}].map(x => (
                      <div key={x.l} style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#4a6380' }}>
                        <div style={{width:10,height:10,borderRadius:2,background:x.c}}/>
                        {x.l}
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#162d47" vertical={false}/>
                      <XAxis dataKey="month" tick={{ fill: '#4a6380', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: '#4a6380', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Line type="monotone" dataKey="complete" name="Complete" stroke={CHART_COLORS.complete} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.complete }} strokeDasharray="0"/>
                      <Line type="monotone" dataKey="wip" name="WIP" stroke={CHART_COLORS.wip} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.wip }} strokeDasharray="4 3"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #162d47' }}>
                      {['Employee','Total tasks','Completed','In progress','Completion %','Status'].map(h => (
                        <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#4a6380', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employeeData.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#4a6380' }}>No data for selected period</td></tr>
                    ) : employeeData.map(emp => {
                      const t = emp.complete + emp.wip
                      const pct = t > 0 ? Math.round((emp.complete / t) * 100) : 0
                      return (
                        <tr key={emp.name} style={{ borderBottom: '1px solid #0d1b2e' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#0d1b2e')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '12px 20px', color: '#e8edf5', fontWeight: 500 }}>{emp.name}</td>
                          <td style={{ padding: '12px 20px', color: '#e8edf5' }}>{t}</td>
                          <td style={{ padding: '12px 20px', color: '#4ade80' }}>{emp.complete}</td>
                          <td style={{ padding: '12px 20px', color: '#fbbf24' }}>{emp.wip}</td>
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 4, background: '#162d47', borderRadius: 2, maxWidth: 80 }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: pct >= 75 ? '#4ade80' : '#fbbf24', borderRadius: 2 }}/>
                              </div>
                              <span style={{ color: '#8ba3c4', fontSize: 12 }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{
                              background: pct >= 75 ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
                              color: pct >= 75 ? '#4ade80' : '#fbbf24',
                              padding: '3px 10px', borderRadius: 20, fontSize: 12
                            }}>{pct >= 75 ? 'On track' : 'Needs attention'}</span>
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
                <h3 style={{ fontFamily: 'Syne,sans-serif', fontSize: 14, fontWeight: 600, color: '#8ba3c4', margin: '0 0 20px' }}>Tasks by goal category</h3>
                {goalsData.length === 0 ? (
                  <p style={{ color: '#4a6380', textAlign: 'center', padding: 32 }}>No data for selected period</p>
                ) : goalsData.map((g, i) => {
                  const maxCount = goalsData[0].count
                  const pct = Math.round((g.count / maxCount) * 100)
                  const colors = ['#3872c8','#4ade80','#fbbf24','#f87171','#a78bfa','#34d399','#fb923c','#60a5fa']
                  return (
                    <div key={g.name} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#e8edf5' }}>{g.name}</span>
                        <span style={{ fontSize: 13, color: '#4a6380' }}>{g.count} tasks</span>
                      </div>
                      <div style={{ height: 6, background: '#162d47', borderRadius: 3 }}>
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
