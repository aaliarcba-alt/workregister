import { NextResponse } from 'next/server'

// DISABLED — this route duplicated app/api/cron/daily-reminder's logic using
// a separate Gmail/nodemailer sender, wasn't wired into vercel.json's "crons"
// (so nothing ever called it automatically), and had two employee email
// typos (sanjeev_singh@ instead of sanjeev_singh2@, riya_agarwal@ instead of
// riya_agrawal@) that had drifted from the canonical list in lib/supabase.ts.
//
// The daily "no entry" reminder logic (and the Friday weekly summary) now
// lives in a single place: app/api/cron/daily-reminder/route.ts, using
// Gmail via lib/gmailMailer.ts. This file is left as a disabled stub
// rather than deleted — feel free to delete this folder
// (app/api/send-reminders) entirely if you don't need it for reference.

export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint has been disabled — see comments in route.ts. Use /api/cron/daily-reminder instead.' },
    { status: 410 }
  )
}
