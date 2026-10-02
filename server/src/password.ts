import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

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

type ScryptParameters = {
  N: number;
  r: number;
  p: number;
  maxmem: number;
};

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptParameters = PASSWORD_SCRYPT_OPTIONS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived as Buffer);
    });
  });
}

/** Generate a one-time 128-bit initial password for the provisioning CLI. */
export function generateInitialPassword(): string {
  return randomBytes(16).toString("hex");
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

/** Verify a password against the versioned scrypt encoding without throwing on malformed input. */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [version, parameterText, saltText, digestText, extra] = encoded.split("$");
    if (extra !== undefined || version !== PASSWORD_HASH_VERSION || !parameterText || !saltText || !digestText) {
      return false;
    }
    const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(parameterText);
    if (!match) return false;
    const parameters = {
      N: Number(match[1]),
      r: Number(match[2]),
      p: Number(match[3]),
      maxmem: PASSWORD_SCRYPT_OPTIONS.maxmem,
    };
    if (parameters.N !== PASSWORD_SCRYPT_OPTIONS.N
      || parameters.r !== PASSWORD_SCRYPT_OPTIONS.r
      || parameters.p !== PASSWORD_SCRYPT_OPTIONS.p) {
      return false;
    }

    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(digestText, "base64url");
    if (salt.length !== 16 || expected.length !== PASSWORD_KEY_LENGTH) return false;
    const actual = await scryptAsync(password, salt, expected.length, parameters);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
