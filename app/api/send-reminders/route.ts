import { NextRequest, NextResponse } from 'next/server'
import { supabase, EMPLOYEES } from '@/lib/supabase'

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM_EMAIL = 'workregister@resend.dev'
const APP_URL = 'https://workregister-nine.vercel.app'

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Resend ${res.status}: ${detail}`)
  }

  return res.json()
}

function reminderHtml(name: string, today: string) {
  return `<p>Hi ${name},</p>
  <p>You have not filled your Work Register for today (<b>${today}</b>).</p>
  <p>Please log in and add your entries:<br/>
  <a href="${APP_URL}">${APP_URL}</a></p>
  <p>Regards,<br/>Sintex Digital Team</p>`
}

export async function GET(req: NextRequest) {
  // Optional auth: if CRON_SECRET is set, require a matching bearer token.
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY is not configured' },
      { status: 500 }
    )
  }

  const today = new Date().toISOString().split('T')[0]

  // Pull every employee_email that has at least one entry today in one query.
  const { data: entries, error } = await supabase
    .from('work_entries')
    .select('employee_email')
    .eq('date', today)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to query work_entries', detail: error.message },
      { status: 500 }
    )
  }

  const filled = new Set((entries || []).map((e) => e.employee_email))
  const missing = EMPLOYEES.filter((emp) => !filled.has(emp.email))

  const sent: string[] = []
  const failed: { email: string; error: string }[] = []

  for (const emp of missing) {
    try {
      await sendEmail(
        emp.email,
        'Reminder: Please fill your Work Register for today',
        reminderHtml(emp.name, today)
      )
      sent.push(emp.email)
    } catch (err) {
      failed.push({
        email: emp.email,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    success: true,
    date: today,
    missingCount: missing.length,
    sent,
    failed,
  })
}
