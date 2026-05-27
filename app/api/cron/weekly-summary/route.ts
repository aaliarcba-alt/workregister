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
]

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM_EMAIL = 'workregister@resend.dev'

async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('work_entries')
    .select('*')
    .gte('date', weekAgo)
    .order('employee_name')

  // Build per-employee summary
  const summaryMap: Record<string, { name: string; completed: string[]; wip: string[] }> = {}
  for (const emp of EMPLOYEES) {
    summaryMap[emp.email] = { name: emp.name, completed: [], wip: [] }
  }
  for (const entry of (data || [])) {
    if (summaryMap[entry.employee_email]) {
      if (entry.status === 'Complete') {
        summaryMap[entry.employee_email].completed.push(entry.task_details)
      } else {
        summaryMap[entry.employee_email].wip.push(entry.task_details)
      }
    }
  }

  // Build email HTML for Manish
  let emailBody = `<h2 style="color:#0d1b2e;">Weekly Work Register Summary</h2>
  <p>Week: <b>${weekAgo}</b> to <b>${today}</b></p>
  <hr/>`

  for (const emp of EMPLOYEES) {
    const s = summaryMap[emp.email]
    const completedList = s.completed.length > 0
      ? s.completed.map(t => `<li>${t}</li>`).join('')
      : '<li style="color:#888">No completed tasks</li>'
    const wipList = s.wip.length > 0
      ? s.wip.map(t => `<li>${t}</li>`).join('')
      : '<li style="color:#888">None</li>'

    emailBody += `
    <div style="margin-bottom:24px;">
      <h3 style="color:#3872c8;margin-bottom:8px;">${s.name}</h3>
      <p><b>✅ Completed Tasks:</b></p>
      <ul>${completedList}</ul>
      <p><b>🔄 Pending / WIP:</b></p>
      <ul>${wipList}</ul>
      <hr/>
    </div>`
  }

  await sendEmail(
    'manish_korgaonkar@welspun.com',
    `Weekly Work Register Summary — ${today}`,
    emailBody
  )

  // Also send each employee their own summary
  for (const emp of EMPLOYEES) {
    const s = summaryMap[emp.email]
    const completedList = s.completed.length > 0
      ? s.completed.map(t => `<li>${t}</li>`).join('')
      : '<li style="color:#888">No completed tasks this week</li>'
    const wipList = s.wip.length > 0
      ? s.wip.map(t => `<li>${t}</li>`).join('')
      : '<li style="color:#888">None</li>'

    await sendEmail(
      emp.email,
      `Your Weekly Work Summary — ${today}`,
      `<h2 style="color:#0d1b2e;">Your Work Summary This Week</h2>
      <p>Week: <b>${weekAgo}</b> to <b>${today}</b></p>
      <hr/>
      <p><b>✅ Completed Tasks:</b></p>
      <ul>${completedList}</ul>
      <p><b>🔄 Pending / WIP:</b></p>
      <ul>${wipList}</ul>
      <p>Keep up the great work!<br/>Sintex Digital Team</p>`
    )
  }

  return NextResponse.json({ success: true, weekOf: weekAgo })
}
