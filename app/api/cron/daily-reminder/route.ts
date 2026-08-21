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

// Simple daily reminder: checks whether each employee filled their Work
// Register for the PREVIOUS working day, and emails anyone who didn't.
// Scheduled Mon–Fri at 10:00 AM IST (see vercel.json) — since the cron
// itself never fires on Sat/Sun, Monday's run naturally checks Friday.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const missing: string[] = []

  for (const emp of EMPLOYEES) {
    const { data } = await supabase
      .from('work_entries')
      .select('id')
      .eq('employee_email', emp.email)
      .eq('date', yesterday)

    if (!data || data.length === 0) {
      missing.push(emp.name)
      await sendGmailEmail({
        to: emp.email,
        cc: ['aalia_dandawala@welspun.com', 'manish_korgaonkar@welspun.com'],
        subject: `Reminder: Please fill your Work Register for ${yesterday}`,
        htmlBody: `<p>Hi ${emp.name},</p>
        <p>You have not filled your Work Register for <b>${yesterday}</b>.</p>
        <p>Please log in and add your entries:<br/>
        <a href="https://workregister-nine.vercel.app">https://workregister-nine.vercel.app</a></p>
        <p>Regards,<br/>Sintex Digital Team</p>`,
      })
    }
  }

  return NextResponse.json({ success: true, date: yesterday, missing })
}
