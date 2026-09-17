import { randomBytes, scrypt } from "node:crypto";

const PASSWORD_HASH_VERSION = "scrypt-v1";
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SCRYPT_OPTIONS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 } as const;

export function validatePasswordInput(value: string): string[] {
  const errors: string[] = [];
  const codePoints = Array.from(value).length;
  const byteLength = Buffer.byteLength(value, "utf8");
  if (codePoints < 15 || codePoints > 128) errors.push("Password must contain 15 to 128 characters.");
  if (value.trim().length === 0) errors.push("Password cannot be whitespace only.");
  if (byteLength > 512) errors.push("Password is too long.");
  return errors;
}

function scryptAsync(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, PASSWORD_SCRYPT_OPTIONS, (error, derived) => {
      if (error) reject(error);
      else resolve(derived as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);
  return [
    PASSWORD_HASH_VERSION,
    `N=${PASSWORD_SCRYPT_OPTIONS.N},r=${PASSWORD_SCRYPT_OPTIONS.r},p=${PASSWORD_SCRYPT_OPTIONS.p}`,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}
