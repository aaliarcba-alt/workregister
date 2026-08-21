// UNUSED — we tried Microsoft Graph API for sending mail (matching the setup
// used in another project), but that requires an Azure AD App Registration
// with Mail.Send permission and admin consent, which wasn't available for
// this app. The cron routes now use lib/gmailMailer.ts (Gmail + nodemailer)
// instead. This file is kept as a disabled stub for reference — feel free
// to delete lib/graphMailer.ts entirely if you don't need it.
export {}
