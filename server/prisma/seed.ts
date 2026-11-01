import { getPrisma } from "../src/prisma.js";
import { seedAllFixtures } from "./seed-data.js";

async function main() {
  const prisma = getPrisma();
  await seedAllFixtures(prisma);

  console.log("Seeded Lab 2 reference data and Lab 3/Lab 4 local fixtures successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
