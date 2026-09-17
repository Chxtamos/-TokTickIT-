import { getPrisma } from "../src/prisma.js";
import { seedLab2ReferenceData, seedLab3Fixtures } from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  await seedLab2ReferenceData(prisma);
  await seedLab3Fixtures(prisma);

  console.log("Seeded Lab 2 reference data and Lab 3 local fixtures successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
