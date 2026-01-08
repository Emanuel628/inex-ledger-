import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const PLACEHOLDER_KEY = 'luna_secure_vault_32_chars_long!';

const getKey = () => {
  const key = process.env.ENCRYPTION_KEY || PLACEHOLDER_KEY;
  const buffer = Buffer.alloc(32);
  Buffer.from(key).copy(buffer);
  return buffer;
};

export const encryptToken = (text) => {
  if (!text) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptToken = (encryptedText) => {
  if (!encryptedText) return null;

  const [ivHex, dataHex] = encryptedText.split(':');
  if (!ivHex || !dataHex) return null;

  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf8');
};
