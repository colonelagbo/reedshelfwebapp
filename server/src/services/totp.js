import crypto from 'crypto';

/**
 * Base32 decode a string into a Buffer (RFC 4648)
 * @param {string} str
 * @returns {Buffer}
 */
export function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Base32 encode a buffer into a string (RFC 4648)
 * @param {Buffer} buffer
 * @returns {string}
 */
export function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (let i = 0; i < buffer.length; i++) {
    bits += buffer[i].toString(2).padStart(8, '0');
  }
  let res = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substr(i, 5);
    if (chunk.length < 5) {
      res += alphabet[parseInt(chunk.padEnd(5, '0'), 2)];
    } else {
      res += alphabet[parseInt(chunk, 2)];
    }
  }
  return res;
}

/**
 * Generate a new random Base32 secret key for Google Authenticator
 * @param {number} lengthBytes (default 20 bytes = 160 bits)
 * @returns {string}
 */
export function generateSecret(lengthBytes = 20) {
  return base32Encode(crypto.randomBytes(lengthBytes));
}

/**
 * Generate the TOTP code for a given secret at current time or given counter
 * @param {string} secret Base32 encoded secret
 * @param {number} [timeStep=30] 30 seconds
 * @returns {string} 6-digit code
 */
export function generateTOTP(secret, timeStep = 30) {
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return code.toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code against a Base32 secret with clock drift tolerance
 * @param {string} token 6-digit code entered by user
 * @param {string} secret Base32 encoded secret
 * @param {number} [window=1] Tolerance window (±1 step = ±30 seconds)
 * @param {number} [timeStep=30]
 * @returns {boolean}
 */
export function verifyTOTP(token, secret, window = 1, timeStep = 30) {
  if (!token || !secret) return false;
  const cleanedToken = String(token).trim().replace(/\s+/g, '');
  if (cleanedToken.length !== 6 || !/^\d{6}$/.test(cleanedToken)) return false;

  try {
    const currentCounter = Math.floor(Date.now() / 1000 / timeStep);
    const key = base32Decode(secret);

    for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
      const counter = currentCounter + errorWindow;
      const buf = Buffer.alloc(8);
      buf.writeBigInt64BE(BigInt(counter));
      const hmac = crypto.createHmac('sha1', key).update(buf).digest();
      const offset = hmac[hmac.length - 1] & 0xf;
      const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
      if (code === cleanedToken) return true;
    }
  } catch (err) {
    console.error('[TOTP Verification Error]', err);
    return false;
  }
  return false;
}

/**
 * Generate otpauth URI for Google Authenticator / QR codes
 * @param {string} email
 * @param {string} secret
 * @param {string} [issuer='ReedShelf']
 * @returns {string}
 */
export function getOtpAuthUrl(email, secret, issuer = 'ReedShelf') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate public QR code image URL for scanning in Google Authenticator
 * @param {string} otpAuthUrl
 * @returns {string}
 */
export function getQrCodeUrl(otpAuthUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(otpAuthUrl)}&margin=10`;
}
