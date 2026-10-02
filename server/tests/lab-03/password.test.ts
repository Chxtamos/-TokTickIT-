import { describe, expect, it } from "vitest";
import {
  generateInitialPassword,
  hashPassword,
  validatePasswordInput,
  verifyPassword,
} from "../../src/password.js";

describe("Lab 3 password primitives", () => {
  it("enforces the documented password bounds", () => {
    expect(validatePasswordInput("short")).toEqual(expect.arrayContaining([expect.stringContaining("15 to 128")]));
    expect(validatePasswordInput("a".repeat(15))).toEqual([]);
    expect(validatePasswordInput("a".repeat(129))).toEqual(expect.arrayContaining([expect.stringContaining("15 to 128")]));
    expect(validatePasswordInput(" ".repeat(15))).toEqual(expect.arrayContaining([expect.stringContaining("whitespace only")]));
    expect(validatePasswordInput("🙂".repeat(15))).toEqual([]);
    expect(validatePasswordInput("ก".repeat(513))).toEqual(expect.arrayContaining([expect.stringContaining("too long")]));
  });

  it("hashes with a salted versioned encoding and verifies valid and invalid passwords", async () => {
    const password = "correct horse battery staple";
    const encoded = await hashPassword(password);
    expect(encoded).toMatch(/^scrypt-v1\$N=131072,r=8,p=1\$[^$]+\$[^$]+$/);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword("a different password", encoded)).resolves.toBe(false);
    await expect(verifyPassword(password, `${encoded}$unexpected`)).resolves.toBe(false);
    await expect(verifyPassword(password, "not-a-password-hash")).resolves.toBe(false);
  });

  it("generates 16-byte hexadecimal initial passwords without persistent state", () => {
    const first = generateInitialPassword();
    const second = generateInitialPassword();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toMatch(/^[0-9a-f]{32}$/);
    expect(second).not.toBe(first);
  });
});
