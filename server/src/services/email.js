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
    // If a custom SMTP host is explicitly specified (such as Brevo: smtp-relay.brevo.com)
    if (host && host !== 'smtp.gmail.com') {
      cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465 || process.env.SMTP_SECURE === 'true',
        auth: { user, pass }
      });
      return cachedTransporter;
    }

    // Default to Gmail if host is smtp.gmail.com or not specified
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
    return cachedTransporter;
  }

  return null;
}

export async function sendEmailVerificationCode({ email, name, code }) {
  const recipientName = (name && name.trim()) || 'Reader';
  const targetEmail = String(email || '').trim().toLowerCase();
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
  const rawFrom = (process.env.EMAIL_FROM || '').trim();
  
  let fromAddress;
  if (rawFrom && rawFrom.includes('@')) {
    fromAddress = rawFrom.includes('<') ? rawFrom : `"ReedShelf" <${rawFrom}>`;
  } else {
    const verifiedEmail = smtpUser.includes('@smtp-brevo.com') ? adminEmail : (smtpUser || adminEmail || 'noreply@reedshelf.app');
    fromAddress = `"ReedShelf" <${verifiedEmail}>`;
  }
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

  // Email service is disabled / bypassed per configuration request
  logConsoleVerification(targetEmail, code);
  const transporter = getTransporter();
  if (transporter) {
    try {
      console.log(`[EMAIL SERVICE] Attempting dispatch to ${targetEmail}...`);
      await transporter.sendMail({
        from: fromAddress,
        to: targetEmail,
        replyTo: fromAddress,
        subject,
        text: textContent,
        html: htmlContent
      });
      return { success: true, mode: 'smtp', recipient: targetEmail };
    } catch (err) {
      console.warn(`[EMAIL SERVICE] Email sending bypassed (SMTP error: ${err.message})`);
    }
  }
  return { success: true, mode: 'bypassed', recipient: targetEmail };
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