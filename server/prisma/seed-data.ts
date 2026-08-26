import type { PrismaClient } from "@prisma/client";

export const lab2Categories = ["Account and Access", "Hardware", "Software", "Network"];

export const lab2RelatedSystems = [
  "Email",
  "Campus Wi-Fi",
  "VPN",
  "LEB2 App",
  "Grade Submission App",
  "Printer",
  "Corporate Laptop",
];

export const lab2Requesters = [
  { name: "Anan Srisuk", email: "anan.srisuk@example.test", isActive: true },
  { name: "Benjamas Kittipong", email: "benjamas.kittipong@example.test", isActive: true },
  { name: "Chaiwat Somchai", email: "chaiwat.somchai@example.test", isActive: true },
  { name: "Daranee Ploy", email: "daranee.ploy@example.test", isActive: true },
  { name: "Inactive Requester", email: "inactive.requester@example.test", isActive: false },
];

export async function seedLab2ReferenceData(prisma: PrismaClient) {
  for (const name of lab2Categories) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const name of lab2RelatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const requester of lab2Requesters) {
    const email = requester.email.trim().toLowerCase();

    await prisma.requesterUser.upsert({
      where: { email },
      update: { name: requester.name, isActive: requester.isActive },
      create: { ...requester, email },
    });
  }
}
