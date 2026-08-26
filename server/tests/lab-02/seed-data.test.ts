import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import {
  lab2Categories,
  lab2RelatedSystems,
  lab2Requesters,
  seedLab2ReferenceData,
} from "../../prisma/seed-data.js";

describe("Lab 2 reference-data seed", () => {
  it("is idempotent and provides the required active and inactive reference data", async () => {
    const prisma = getPrisma();

    await seedLab2ReferenceData(prisma);
    await seedLab2ReferenceData(prisma);

    const [categories, relatedSystems, requesters] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.relatedSystem.findMany({ orderBy: { name: "asc" } }),
      prisma.requesterUser.findMany({ orderBy: { email: "asc" } }),
    ]);

    expect(categories.filter((category) => category.isActive).map((category) => category.name).sort()).toEqual(
      [...lab2Categories].sort(),
    );
    expect(relatedSystems.filter((system) => system.isActive).map((system) => system.name).sort()).toEqual(
      [...lab2RelatedSystems].sort(),
    );
    expect(requesters).toHaveLength(lab2Requesters.length);
    expect(requesters.filter((requester) => requester.isActive)).toHaveLength(4);
    expect(requesters.filter((requester) => !requester.isActive)).toHaveLength(1);
    expect(requesters.map((requester) => requester.email)).toEqual(
      [...lab2Requesters.map((requester) => requester.email)].sort(),
    );
  });
});
