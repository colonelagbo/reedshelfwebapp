import nodemailer from 'nodemailer';

let cachedTransporter = null;

export function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const pass = rawPass.replace(/\s+/g, '').trim();

  if (user && pass) {
    if (host === 'smtp.gmail.com' || user.endsWith('@gmail.com') || (!host && user)) {
      cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });
      return cachedTransporter;
    }

    if (host) {
      cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465 || process.env.SMTP_SECURE === 'true',
        auth: { user, pass }
      });
      return cachedTransporter;
    }
  }

  return null;
}

export async function sendEmailVerificationCode({ email, name, code }) {
  const recipientName = (name && name.trim()) || 'Reader';
  const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || 'ReedShelf Security <noreply@reedshelf.app>';
  const subject = `${code} is your ReedShelf verification code`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReedShelf Verification Code</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f6f4ee; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0b1619;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 500px; background-color: #ffffff; border: 1px solid #e4e1d6; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #009689 0%, #007268 100%); padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">ReedShelf</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Email Address Authenticator</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; margin: 0 0 16px 0; color: #0b1619;">
                Hello <strong>${recipientName}</strong>,
              </p>
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
                To complete your registration and ensure that your email address is correct, please enter the following 6-digit authenticator verification code in ReedShelf:
              </p>

              <!-- Verification Code Box -->
              <div style="background-color: #f6f4ee; border: 2px dashed #009689; border-radius: 14px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
                <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #007268; display: inline-block; padding-left: 10px;">
                  ${code}
                </span>
              </div>

              <!-- Security Info -->
              <table width="100%" style="background-color: #fbfcf9; border-radius: 10px; padding: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 12px; color: #6b7280; line-height: 1.5;">
                    ⏱️ This code will expire in <strong>10 minutes</strong>.<br>
                    🔒 Never share this code with anyone. ReedShelf will never ask for it.
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin: 0;">
                If you did not attempt to register on ReedShelf, you can safely ignore this email. No account will be created without this verification code.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fbfcf9; border-top: 1px solid #f0eee6; padding: 18px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                © ${new Date().getFullYear()} ReedShelf • Private digital bookshelf
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const textContent = `ReedShelf Email Verification Code: ${code}

Hello ${recipientName},

Your 6-digit authenticator verification code to create your ReedShelf account is:

${code}

This code expires in 10 minutes.

If you did not request this, please ignore this email.
`;

  // Skip external mailer for synthetic test addresses to preserve quota for real users
  const isTestEmail = email.endsWith('@example.com') || email.endsWith('@test.com') || process.env.NODE_ENV === 'test';
  if (isTestEmail) {
    logConsoleVerification(email, code);
    return { success: true, mode: 'dev_console' };
  }

  const transporter = getTransporter();

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        text: textContent,
        html: htmlContent
      });
      console.log(`[EMAIL SERVICE] Verification email sent to ${email} via SMTP: ${info.messageId}`);
      return { success: true, mode: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`[EMAIL SERVICE] Failed to send via SMTP to ${email}:`, err.message);
      logConsoleVerification(email, code);
      return { success: true, mode: 'fallback_console', error: err.message };
    }
  }

  // If no SMTP configured, dispatch real email verification via Supabase Mailer
  try {
    const { getSupabaseClient } = await import('../storage/supabase.js');
    const supabase = getSupabaseClient();
    if (supabase?.auth?.signInWithOtp) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true
        }
      });
      if (error) {
        console.warn(`[EMAIL SERVICE] Supabase OTP send warning for ${email}:`, error.message);
        if (error.status === 429) {
          throw new Error(error.message || 'Please wait a moment before requesting another verification code.');
        }
      } else {
        console.log(`[EMAIL SERVICE] Real authenticator verification code dispatched to email: ${email}`);
        return { success: true, mode: 'supabase_otp' };
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('security purposes')) {
      throw err;
    }
    console.warn('[EMAIL SERVICE] Supabase mailer fallback:', err.message);
  }

  // Log to console in dev mode
  logConsoleVerification(email, code);
  return { success: true, mode: 'dev_console' };
}

function logConsoleVerification(email, code) {
  console.log('\n========================================================================');
  console.log('📧 [REEDSHELF EMAIL AUTHENTICATOR VERIFICATION]');
  console.log(`   To:      ${email}`);
  console.log(`   Code:    ${code}`);
  console.log('   Expires: 10 minutes');
  console.log('   Note:    To send real emails to your inbox, set SMTP_HOST, SMTP_USER,');
  console.log('            and SMTP_PASS in your .env file.');
  console.log('========================================================================\n');
}