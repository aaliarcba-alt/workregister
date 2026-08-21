import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendGmailEmail } from '@/lib/gmailMailer'

// STANDALONE ROUTE — not currently scheduled in vercel.json.
// On the Vercel Hobby plan, only one cron trigger fires per day, so the
// weekly summary logic now runs from inside app/api/cron/daily-reminder/route.ts
// on Fridays instead. This route is kept working and callable manually
// (or re-add it to vercel.json's "crons" array if you upgrade to Vercel Pro,
// which allows more than one cron schedule).

const EMPLOYEES = [
  { name: 'Aalia Dandawala',   email: 'aalia_dandawala@welspun.com' },
  { name: 'Sundari Maurya',    email: 'sundari_maurya@welspun.com' },
  { name: 'Shravan Jadhav',    email: 'shravan_jadhav@welspun.com' },
  { name: 'Sharad Yadav',      email: 'sharad_yadav1@welspun.com' },
  { name: 'Sanjeev Singh',     email: 'sanjeev_singh2@welspun.com' },
  { name: 'Riya Agarwal',      email: 'riya_agrawal@welspun.com' },
  { name: 'Rajesh Mishra',     email: 'rajesh_mishra@welspun.com' },
  { name: 'Deepika Dalvi',     email: 'deepika_dalvi@welspun.com' },
  { name: 'Hemil Shah',        email: 'hemil_shah@welspun.com' },
  { name: 'Rahul Pandey',      email: 'rahul_pandey@welspun.com' },
  { name: 'Siva Nosina',       email: 'siva_nosina@welspun.com' },
  { name: 'Kaustub Mule',      email: 'kaustub_mule@welspun.com' },
]

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

  const summaryMap: Record<string, { name: string; completed: string[]; wip: string[] }> = {}
  for (const emp of EMPLOYEES) {
    summaryMap[emp.email] = { name: emp.name, completed: [], wip: [] }
  }
  for (const entry of data || []) {
    if (summaryMap[entry.employee_email]) {
      if (entry.status === 'Complete') {
        summaryMap[entry.employee_email].completed.push(entry.task_details)
      } else {
        summaryMap[entry.employee_email].wip.push(entry.task_details)
      }
    }
  }

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

  await sendGmailEmail({
    to: 'manish_korgaonkar@welspun.com',
    subject: `Weekly Work Register Summary — ${today}`,
    htmlBody: emailBody,
  })

  for (const emp of EMPLOYEES) {
    const s = summaryMap[emp.email]
    const completedList = s.completed.length > 0
      ? s.completed.map(t => `<li>${t}</li>`).join('')
      : '<li style="color:#888">No completed tasks this week</li>'
    const wipList = s.wip.length > 0
      ? s.wip.map(t => `<li>${t}</li>`).join('')
      : '<li style="color:#888">None</li>'

    await sendGmailEmail({
      to: emp.email,
      subject: `Your Weekly Work Summary — ${today}`,
      htmlBody: `<h2 style="color:#0d1b2e;">Your Work Summary This Week</h2>
      <p>Week: <b>${weekAgo}</b> to <b>${today}</b></p>
      <hr/>
      <p><b>✅ Completed Tasks:</b></p>
      <ul>${completedList}</ul>
      <p><b>🔄 Pending / WIP:</b></p>
      <ul>${wipList}</ul>
      <p>Keep up the great work!<br/>Sintex Digital Team</p>`,
    })
  }

  return NextResponse.json({ success: true, weekOf: weekAgo })
}
