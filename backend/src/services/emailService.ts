import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (transporter) return transporter;

  // Works with Gmail (app password) or any SMTP sandbox like Mailtrap -
  // just point the env vars at whichever you're using.
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

export const sendOtpEmail = async (to: string, otp: string): Promise<void> => {
  // In development without SMTP creds configured, log to console instead of
  // failing the whole request - keeps local dev unblocked.
  if (!process.env.SMTP_HOST) {
    console.log(`[email:dev-mode] OTP for ${to}: ${otp} (SMTP not configured, would normally email this)`);
    return;
  }

  const mailer = getTransporter();
  await mailer.sendMail({
    from: process.env.SMTP_FROM || '"Nexus Platform" <no-reply@nexus.dev>',
    to,
    subject: 'Your Nexus verification code',
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
};
