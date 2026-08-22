import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const TOKEN_LENGTH = 32;

export function generatePublicToken(length = TOKEN_LENGTH): string {
  if (!Number.isInteger(length) || length < TOKEN_LENGTH) {
    throw new Error(`Public token length must be an integer of at least ${TOKEN_LENGTH}`);
  }
  let token = '';
  while (token.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte < 248) token += ALPHABET[byte % ALPHABET.length];
      if (token.length === length) break;
    }
  }
  return token;
}