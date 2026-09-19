import { Prisma } from "@prisma/client";

// Issue #63 must use this same transaction-scoped key before changing an
// account's role/activation. The pair prevents assignment eligibility checks
// from racing a future demotion/deactivation without globally serializing all
// unrelated accounts.
const ACCOUNT_SAFETY_LOCK_NAMESPACE = 1_954_603_201;

export type AccountSafetyLockTransaction = {
  $queryRaw: (query: Prisma.Sql) => Promise<unknown>;
};

export async function lockAccountSafety(
  transaction: AccountSafetyLockTransaction,
  userId: number,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(CAST(${ACCOUNT_SAFETY_LOCK_NAMESPACE} AS INTEGER), CAST(${userId} AS INTEGER))`,
  );
}
