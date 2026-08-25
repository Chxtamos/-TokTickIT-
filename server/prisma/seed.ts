import { getPrisma } from "../src/prisma.js";

const categories = ["Account and Access", "Hardware", "Software", "Network"];

const relatedSystems = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

const requesters = [
  { name: "Anan Srisuk", email: "anan.srisuk@example.test", isActive: true },
  { name: "Benjamas Kittipong", email: "benjamas.kittipong@example.test", isActive: true },
  { name: "Chaiwat Somchai", email: "chaiwat.somchai@example.test", isActive: true },
  { name: "Daranee Ploy", email: "daranee.ploy@example.test", isActive: true },
  { name: "Inactive Requester", email: "inactive.requester@example.test", isActive: false },
];

async function main() {
  const prisma = getPrisma();

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const requester of requesters) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: requester,
    });
  }

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
