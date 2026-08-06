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
  { name: 'Kaustub Mule',       email: 'kaustub_mule@welspun.com' },

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

  const today = new Date().toISOString().split('T')[0]
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const results = { noEntry: [] as string[], lowHours: [] as string[], twoDayMissing: [] as string[] }

  for (const emp of EMPLOYEES) {
    // Check today's entries
    const { data: todayData } = await supabase
      .from('work_entries')
      .select('time_taken')
      .eq('employee_email', emp.email)
      .eq('date', today)

    if (!todayData || todayData.length === 0) {
      // No entry today — send reminder
      results.noEntry.push(emp.name)
      await sendEmail(
        emp.email,
        'Reminder: Please fill your Work Register for today',
        `<p>Hi ${emp.name},</p>
        <p>You have not filled your Work Register for today (<b>${today}</b>).</p>
        <p>Please log in and add your entries:<br/>
        <a href="https://workregister-nine.vercel.app">https://workregister-nine.vercel.app</a></p>
        <p>Regards,<br/>Sintex Digital Team</p>`
      )

      // Check if also missing yesterday (2 day check)
      const { data: twoDayData } = await supabase
        .from('work_entries')
        .select('date')
        .eq('employee_email', emp.email)
        .gte('date', twoDaysAgo)

      if (!twoDayData || twoDayData.length === 0) {
        results.twoDayMissing.push(emp.name)
        // Email employee
        await sendEmail(
          emp.email,
          'Urgent: Work Register not filled for 2 days',
          `<p>Hi ${emp.name},</p>
          <p>You have not filled your Work Register for the past <b>2 days</b>.</p>
          <p>Your manager has been notified. Please log in immediately:<br/>
          <a href="https://workregister-nine.vercel.app">https://workregister-nine.vercel.app</a></p>
          <p>Regards,<br/>Sintex Digital Team</p>`
        )
        // Email Manish
        await sendEmail(
          'manish_korgaonkar@welspun.com',
          `Work Register Alert: ${emp.name} — No entry for 2 days`,
          `<p>Hi Manish,</p>
          <p><b>${emp.name}</b> (${emp.email}) has not filled their Work Register for the past 2 days.</p>
          <p>Please follow up with them.</p>
          <p>Regards,<br/>Sintex Digital Team</p>`
        )
      }
    } else {
      // Has entry — check if hours < 8
      const totalHours = todayData.reduce((sum, e) => sum + (e.time_taken || 0), 0)
      if (totalHours > 0 && totalHours < 8) {
        results.lowHours.push(emp.name)
        await sendEmail(
          emp.email,
          'Work Register: Hours seem low today',
          `<p>Hi ${emp.name},</p>
          <p>Your total logged hours for today are <b>${totalHours} hours</b>, which is less than 8 hours.</p>
          <p>Please review and update your Work Register if needed:<br/>
          <a href="https://workregister-nine.vercel.app">https://workregister-nine.vercel.app</a></p>
          <p>Regards,<br/>Sintex Digital Team</p>`
        )
      }
    }
  }

  return NextResponse.json({ success: true, date: today, ...results })
}
