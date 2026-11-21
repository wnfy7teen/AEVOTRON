import nodemailer from "nodemailer";

let transport;
function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return null;
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || "",
    } : undefined,
  });
  return transport;
}

export async function sendActionEmail({ to, subject, text, html }) {
  const mailer = getTransport();
  if (!mailer) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_NOT_CONFIGURED");
    return false;
  }
  await mailer.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
  return true;
}

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}
