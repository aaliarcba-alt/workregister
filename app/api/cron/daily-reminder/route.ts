import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendGmailEmail } from '@/lib/gmailMailer'

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

// NOTE ON SCHEDULING (Vercel Hobby plan):
// Hobby allows only ONE cron trigger to actually fire per day, so this single
// route now covers both jobs that used to be separate crons:
//   1. The daily no-entry / low-hours / two-day-missing checks (every day)
//   2. The weekly summary email (only when today is Friday)
// If you upgrade to Vercel Pro, you can split these back into two crons with
// their own exact schedules (see app/api/cron/weekly-summary/route.ts, which
// is kept as a standalone route you can re-add to vercel.json at that point).

async function runDailyChecks() {
  const today = new Date().toISOString().split('T')[0]
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const results = { noEntry: [] as string[], lowHours: [] as string[], twoDayMissing: [] as string[] }

  for (const emp of EMPLOYEES) {
    const { data: todayData } = await supabase
      .from('work_entries')
      .select('time_taken')
      .eq('employee_email', emp.email)
      .eq('date', today)

    if (!todayData || todayData.length === 0) {
      results.noEntry.push(emp.name)
      await sendGmailEmail({
        to: emp.email,
        subject: 'Reminder: Please fill your Work Register for today',
        htmlBody: `<p>Hi ${emp.name},</p>
        <p>You have not filled your Work Register for today (<b>${today}</b>).</p>
        <p>Please log in and add your entries:<br/>
        <a href="https://workregister-nine.vercel.app">https://workregister-nine.vercel.app</a></p>
        <p>Regards,<br/>Sintex Digital Team</p>`,
      })

      const { data: twoDayData } = await supabase
        .from('work_entries')
        .select('date')
        .eq('employee_email', emp.email)
        .gte('date', twoDaysAgo)

      if (!twoDayData || twoDayData.length === 0) {
        results.twoDayMissing.push(emp.name)
        await sendGmailEmail({
          to: emp.email,
          subject: 'Urgent: Work Register not filled for 2 days',
          htmlBody: `<p>Hi ${emp.name},</p>
          <p>You have not filled your Work Register for the past <b>2 days</b>.</p>
          <p>Your manager has been notified. Please log in immediately:<br/>
          <a href="https://workregister-nine.vercel.app">https://workregister-nine.vercel.app</a></p>
          <p>Regards,<br/>Sintex Digital Team</p>`,
        })
        await sendGmailEmail({
          to: 'manish_korgaonkar@welspun.com',
          subject: `Work Register Alert: ${emp.name} — No entry for 2 days`,
          htmlBody: `<p>Hi Manish,</p>
          <p><b>${emp.name}</b> (${emp.email}) has not filled their Work Register for the past 2 days.</p>
          <p>Please follow up with them.</p>
          <p>Regards,<br/>Sintex Digital Team</p>`,
        })
      }
    } else {
      const totalHours = todayData.reduce((sum, e) => sum + (e.time_taken || 0), 0)
      if (totalHours > 0 && totalHours < 8) {
        results.lowHours.push(emp.name)
        await sendGmailEmail({
          to: emp.email,
          subject: 'Work Register: Hours seem low today',
          htmlBody: `<p>Hi ${emp.name},</p>
          <p>Your total logged hours for today are <b>${totalHours} hours</b>, which is less than 8 hours.</p>
          <p>Please review and update your Work Register if needed:<br/>
          <a href="https://workregister-nine.vercel.app">https://workregister-nine.vercel.app</a></p>
          <p>Regards,<br/>Sintex Digital Team</p>`,
        })
      }
    }
  }

  return { today, ...results }
}

async function runWeeklySummary() {
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

  return { weekOf: weekAgo }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const daily = await runDailyChecks()

  // Friday = day 5. Piggyback the weekly summary onto the same (only) daily
  // cron trigger available on the Vercel Hobby plan.
  const isFriday = new Date().getUTCDay() === 5
  let weekly = null
  if (isFriday) {
    weekly = await runWeeklySummary()
  }

  return NextResponse.json({ success: true, daily, weekly, ranWeeklySummary: isFriday })
}
