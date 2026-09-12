import crypto from 'crypto';

// In-memory store of active verification codes
// Map<normalizedEmail, { code: string, expiresAt: number, lastSentAt: number, attempts: number }>
const activeVerifications = new Map();

const CODE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;       // 60 seconds cooldown
const MAX_ATTEMPTS = 5;

/**
 * Normalizes email address for consistent lookup
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Check if the email address is on resend cooldown
 */
export function getCooldownRemaining(email) {
  const normEmail = normalizeEmail(email);
  const record = activeVerifications.get(normEmail);
  if (!record) return 0;

  const elapsed = Date.now() - record.lastSentAt;
  if (elapsed < RESEND_COOLDOWN_MS) {
    return Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
  }
  return 0;
}

/**
 * Generate a cryptographically secure 6-digit code and store it with expiration
 */
export function createVerification(email) {
  const normEmail = normalizeEmail(email);
  const remaining = getCooldownRemaining(normEmail);

  if (remaining > 0) {
    return {
      allowed: false,
      error: `Please wait ${remaining} second${remaining === 1 ? '' : 's'} before requesting another code.`,
      remainingSeconds: remaining
    };
  }

  // Generate 6-digit number (100000 to 999999)
  const code = String(crypto.randomInt(100000, 1000000));
  const now = Date.now();
  const expiresAt = now + CODE_EXPIRATION_MS;

  activeVerifications.set(normEmail, {
    code,
    expiresAt,
    lastSentAt: now,
    attempts: 0
  });

  return {
    allowed: true,
    code,
    expiresAt,
    cooldownSeconds: 60
  };
}

/**
 * Validate the provided 6-digit code for the specified email address
 */
export function verifyCode(email, inputCode) {
  const normEmail = normalizeEmail(email);
  const record = activeVerifications.get(normEmail);

  if (!record) {
    return {
      valid: false,
      error: 'No active verification code found for this email. Please request a new code.'
    };
  }

  // Check expiration
  if (Date.now() > record.expiresAt) {
    activeVerifications.delete(normEmail);
    return {
      valid: false,
      error: 'The verification code has expired. Please request a new one.'
    };
  }

  // Check max attempts
  if (record.attempts >= MAX_ATTEMPTS) {
    activeVerifications.delete(normEmail);
    return {
      valid: false,
      error: 'Too many incorrect attempts. Please request a new verification code.'
    };
  }

  // Clean candidate code
  const cleanInput = String(inputCode || '').trim();

  if (cleanInput === record.code) {
    // Valid! Consume the code so it cannot be used again
    activeVerifications.delete(normEmail);
    return { valid: true };
  }

  // Increment failed attempts
  record.attempts += 1;
  const attemptsLeft = MAX_ATTEMPTS - record.attempts;

  return {
    valid: false,
    error: `Incorrect verification code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
  };
}

/**
 * Remove verification code for an email
 */
export function clearVerification(email) {
  activeVerifications.delete(normalizeEmail(email));
}