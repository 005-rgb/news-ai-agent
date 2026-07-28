'use strict';

/**
 * AES-256-GCM encryption utility
 * Used for all sensitive data: API keys, WordPress credentials
 * Key source: ENCRYPTION_KEY env variable (32-byte hex string)
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag

function getKey() {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) throw new Error('ENCRYPTION_KEY environment variable is not set');
  const buf = Buffer.from(hexKey, 'hex');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be a 32-byte (64 hex chars) value');
  return buf;
}

/**
 * Encrypt plaintext with AES-256-GCM
 * @param {string} plaintext
 * @returns {string} JSON string with iv, ciphertext, authTag (all base64)
 */
function encrypt(plaintext) {
  if (typeof plaintext !== 'string') throw new TypeError('encrypt() expects a string');
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
  });
}

/**
 * Decrypt value produced by encrypt()
 * @param {string} stored  JSON string from encrypt()
 * @returns {string} original plaintext
 */
function decrypt(stored) {
  if (!stored) return '';
  try {
    const { iv, ciphertext, authTag } = JSON.parse(stored);
    const key = getKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'base64'),
      { authTagLength: TAG_LENGTH }
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    // Never log stored value
    throw new Error(`Decryption failed: ${err.message}`);
  }
}

module.exports = { encrypt, decrypt };
