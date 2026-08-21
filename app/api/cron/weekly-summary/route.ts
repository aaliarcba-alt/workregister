import { NextResponse } from 'next/server'

// DISABLED — weekly summary emails are no longer wanted. The daily cron
// (app/api/cron/daily-reminder/route.ts) now only sends a simple
// "you didn't fill your Work Register for <yesterday>" reminder, with no
// weekly summary piggybacked onto it. This route is kept as a disabled
// stub rather than deleted — delete this folder entirely if you don't
// need it for reference.

export async function GET() {
  return NextResponse.json(
    { error: 'Weekly summary has been disabled — see comments in route.ts.' },
    { status: 410 }
  )
}
