import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// Canonical employee list — same as lib/supabase.ts EMPLOYEES
// Using this instead of querying work_entries so new employees who haven't
// made any entry yet still receive reminders.
const EMPLOYEES = [
  { name: 'Aalia Dandawala', email: 'aalia_dandawala@welspun.com' },
  { name: 'Sundari Maurya',  email: 'sundari_maurya@welspun.com' },
  { name: 'Shravan Jadhav',  email: 'shravan_jadhav@welspun.com' },
  { name: 'Sharad Yadav',    email: 'sharad_yadav1@welspun.com' },
  { name: 'Sanjeev Singh',   email: 'sanjeev_singh2@welspun.com' },
  { name: 'Riya Agarwal',    email: 'riya_agrawal@welspun.com' },
  { name: 'Rajesh Mishra',   email: 'rajesh_mishra@welspun.com' },
  { name: 'Deepika Dalvi',   email: 'deepika_dalvi@welspun.com' },
  { name: 'Hemil Shah',      email: 'hemil_shah@welspun.com' },
  { name: 'Siva Nosina',     email: 'siva_nosina@welspun.com' },
];

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get yesterday in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const yesterday = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get which employees filled yesterday
    const { data: yesterdayEntries, error: dbError } = await supabase
      .from('work_entries')
      .select('employee_email')
      .eq('date', yesterdayStr);

    if (dbError) {
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
    }

    const filledYesterday = new Set(yesterdayEntries?.map(e => e.employee_email) ?? []);

    // Find who is missing (skip weekends — Saturday=6, Sunday=0)
    const dayOfWeek = yesterday.getDay(); // based on IST yesterday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Yesterday was a weekend — no reminders sent',
        date: yesterdayStr,
      });
    }

    const missing = EMPLOYEES.filter(e => !filledYesterday.has(e.email));

    if (missing.length === 0) {
      return NextResponse.json({
        success: true,
        date: yesterdayStr,
        missingCount: 0,
        sent: [],
        failed: [],
        message: 'All employees filled their register — no reminders needed',
      });
    }

    // Send via Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const sent: string[] = [];
    const failed: { email: string; error: string }[] = [];

    for (const employee of missing) {
      try {
        await new Promise(resolve => setTimeout(resolve, 400));
        await transporter.sendMail({
          from: `"Sintex Digital Team" <${process.env.GMAIL_USER}>`,
          to: employee.email,
          cc: 'aalia_dandawala@welspun.com, manish_korgaonkar@welspun.com',
          subject: `Reminder: Please fill your Work Register for ${yesterdayStr}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px;">
              <p>Hi ${employee.name},</p>
              <p>You have not filled your Work Register for <b>${yesterdayStr}</b>.</p>
              <p>Please log in and add your entries:</p>
              <p>
                <a href="https://workregister-nine.vercel.app"
                   style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
                  Open Work Register
                </a>
              </p>
              <br/>
              <p style="color:#888;font-size:12px;">Regards,<br/>Sintex Digital Team</p>
            </div>
          `,
        });
        sent.push(employee.email);
      } catch (err: any) {
        failed.push({ email: employee.email, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      date: yesterdayStr,
      missingCount: missing.length,
      sent,
      failed,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}