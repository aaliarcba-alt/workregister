import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split('T')[0];

    const { data: allEmployees } = await supabase
      .from('work_entries')
      .select('employee_email, employee_name')
      .neq('employee_email', '')
      .not('employee_email', 'is', null);

    const uniqueEmployees = Array.from(
      new Map(allEmployees?.map(e => [e.employee_email, e])).values()
    );

    const { data: todayEntries } = await supabase
      .from('work_entries')
      .select('employee_email')
      .eq('date', today);

    const filledToday = new Set(todayEntries?.map(e => e.employee_email));
    const missing = uniqueEmployees.filter(e => !filledToday.has(e.employee_email));

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const sent = [];
    const failed = [];

    for (const employee of missing) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        await transporter.sendMail({
          from: `"Sintex Digital Team" <${process.env.GMAIL_USER}>`,
          to: employee.employee_email,
          subject: 'Reminder: Please fill your Work Register for today',
          html: `
            <p>Hi ${employee.employee_name},</p>
            <p>You have not filled your Work Register for today (<b>${today}</b>).</p>
            <p>Please log in and add your entries:</p>
            <p><a href="https://workregister-nine.vercel.app">Open Work Register</a></p>
            <br/>
            <p>Regards,<br/>Sintex Digital Team</p>
          `,
        });
        sent.push(employee.employee_email);
      } catch (err: any) {
        failed.push({ email: employee.employee_email, error: err.message });
      }
    }

    return NextResponse.json({ success: true, date: today, missingCount: missing.length, sent, failed });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}