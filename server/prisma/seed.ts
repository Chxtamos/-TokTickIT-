import { getPrisma } from "../src/prisma.js";
import { seedLab2ReferenceData } from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  await seedLab2ReferenceData(prisma);

  console.log("Seeded Lab 2 reference data successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
