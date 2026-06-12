import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const EMPLOYEES = [
  { name: 'Aalia Dandawala',   email: 'aalia_dandawala@welspun.com' },
  { name: 'Sundari Maurya',    email: 'sundari_maurya@welspun.com' },
  { name: 'Shravan Jadhav',    email: 'shravan_jadhav@welspun.com' },
  { name: 'Sharad Yadav',      email: 'sharad_yadav1@welspun.com' },
  { name: 'Sanjeev Singh',     email: 'sanjeev_singh@welspun.com' },
  { name: 'Riya Agarwal',      email: 'riya_agarwal@welspun.com' },
  { name: 'Rajesh Mishra',     email: 'rajesh_mishra@welspun.com' },
  { name: 'Deepika Dalvi',     email: 'deepika_dalvi@welspun.com' },
  { name: 'Hemil Shah',        email: 'hemil_shah@welspun.com' },
  { name: 'Rahul Pandey',      email: 'rahul_pandey@welspun.com' },
  { name: 'Siva Nosina',       email: 'siva_nosina@welspun.com' },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'no-entry'
  const today = new Date().toISOString().split('T')[0]
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  if (type === 'no-entry') {
    const results = []
    for (const emp of EMPLOYEES) {
      const { data } = await supabase
        .from('work_entries')
        .select('id')
        .eq('employee_email', emp.email)
        .eq('date', today)
      if (!data || data.length === 0) results.push(emp)
    }
    return NextResponse.json({ date: today, missing: results })
  }

  if (type === 'low-hours') {
    const results = []
    for (const emp of EMPLOYEES) {
      const { data } = await supabase
        .from('work_entries')
        .select('time_taken')
        .eq('employee_email', emp.email)
        .eq('date', today)
      if (data && data.length > 0) {
        const total = data.reduce((sum, e) => sum + (e.time_taken || 0), 0)
        if (total > 0 && total < 8) results.push({ ...emp, hours: total })
      }
    }
    return NextResponse.json({ date: today, lowHours: results })
  }

  if (type === 'two-day-missing') {
    const results = []
    for (const emp of EMPLOYEES) {
      const { data } = await supabase
        .from('work_entries')
        .select('date')
        .eq('employee_email', emp.email)
        .gte('date', twoDaysAgo)
      if (!data || data.length === 0) results.push(emp)
    }
    return NextResponse.json({ date: today, twodayMissing: results })
  }

  if (type === 'weekly-summary') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data } = await supabase
      .from('work_entries')
      .select('*')
      .gte('date', weekAgo)
      .order('employee_name')

    const summary: Record<string, { name: string; email: string; completed: string[]; wip: string[] }> = {}
    for (const emp of EMPLOYEES) {
      summary[emp.email] = { name: emp.name, email: emp.email, completed: [], wip: [] }
    }
    for (const entry of (data || [])) {
      if (summary[entry.employee_email]) {
        if (entry.status === 'Complete') {
          summary[entry.employee_email].completed.push(entry.task_details)
        } else {
          summary[entry.employee_email].wip.push(entry.task_details)
        }
      }
    }
    return NextResponse.json({ weekOf: weekAgo, summary: Object.values(summary) })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
