import nodemailer from 'nodemailer'

// Gmail mailer — sends reminder/summary emails via a Gmail account + App Password.
// Requires these env vars (set in Vercel → Project → Settings → Environment Variables,
// for the Production environment specifically):
//   GMAIL_USER            the Gmail address that sends the mail
//   GMAIL_APP_PASSWORD    a 16-character App Password (NOT the normal Gmail password) —
//                          generate one at https://myaccount.google.com/apppasswords
//                          (requires 2-Step Verification to be turned on for that account)

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  }
  return transporter
}

export async function sendGmailEmail({
  to,
  cc,
  subject,
  htmlBody,
}: {
  to: string | string[]
  cc?: string | string[]
  subject: string
  htmlBody: string
}) {
  await getTransporter().sendMail({
    from: `"Sintex Digital Team" <${process.env.GMAIL_USER}>`,
    to,
    cc,
    subject,
    html: htmlBody,
  })
}
