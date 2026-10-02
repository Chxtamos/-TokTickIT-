import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { assertIntegrationDatabase, createIntegrationPrisma, isDatabaseIntegrationRequested } from "../../src/prisma.js";
import { createProvisionedTestUser, createTestSession, testClientOrigin } from "../helpers/auth-session.js";

const runIntegration = isDatabaseIntegrationRequested();
if (runIntegration) assertIntegrationDatabase();
const integration = runIntegration ? describe : describe.skip;
const PASSWORD = "admin integration password 2026";

integration("Issue #63 Administrator User Management PostgreSQL safety", () => {
  let prisma: PrismaClient;
  let adminAId: number, adminBId: number, staffId: number, requesterId: number, categoryId: number, relatedSystemId: number;
  let auth: Awaited<ReturnType<typeof createTestSession>>;
  const createdUserIds: number[] = [], createdRequestIds: string[] = [];

  beforeAll(async () => {
    prisma = createIntegrationPrisma(); await prisma.$connect();
    const [category, system, adminA, adminB, staff, requester] = await Promise.all([
      prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true } }),
      createProvisionedTestUser(prisma, "ADMINISTRATOR", "Admin Safety A"), createProvisionedTestUser(prisma, "ADMINISTRATOR", "Admin Safety B"),
      createProvisionedTestUser(prisma, "IT_STAFF", "Admin Safety Staff"), createProvisionedTestUser(prisma, "REQUESTER", "Admin Safety Requester"),
    ]);
    if (!category || !system) throw new Error("Admin integration requires active reference fixtures.");
    categoryId=category.id; relatedSystemId=system.id; adminAId=adminA.id; adminBId=adminB.id; staffId=staff.id; requesterId=requester.id;
    createdUserIds.push(adminAId,adminBId,staffId,requesterId); auth=await createTestSession(prisma,adminAId);
  });

  afterAll(async () => { if(!prisma)return; if(createdRequestIds.length)await prisma.ticket.deleteMany({where:{clientRequestId:{in:createdRequestIds}}}); if(createdUserIds.length)await prisma.requesterUser.deleteMany({where:{id:{in:createdUserIds}}}); await prisma.$disconnect(); });
  function api(){const app=createApp(prisma);const a=(call:request.Test)=>call.set("Cookie",auth.cookie).set("Origin",testClientOrigin).set("X-CSRF-Token",auth.csrfToken);return{post:(p:string)=>a(request(app).post(p)),patch:(p:string)=>a(request(app).patch(p))};}
  async function createOwnedTicket(ownerId:number){const clientRequestId=randomUUID();createdRequestIds.push(clientRequestId);return prisma.ticket.create({data:{ticketNumber:`TKT-2099-${randomUUID().slice(0,8)}`,requesterId,categoryId,relatedSystemId,ticketOwnerId:ownerId,summary:"Issue 63 owner cleanup fixture",description:"Real PostgreSQL owner cleanup fixture.",requestedPriority:"MEDIUM",itPriority:"MEDIUM",currentStatus:"OPEN",version:1,clientRequestId,requestPayloadHash:randomUUID().replaceAll("-","").padEnd(64,"0")}});}

  it("normalizes email uniqueness and rejects a stale expectedVersion",async()=>{
    const email=`Admin.Integration.${randomUUID()}@Example.Test`; const created=await api().post("/api/admin/users").send({name:"Integration User",email:` ${email} `,role:"REQUESTER",isActive:true,initialPassword:PASSWORD});
    expect(created.status).toBe(201);createdUserIds.push(created.body.user.id);expect(created.body.user.email).toBe(email.toLowerCase());
    const duplicate=await api().post("/api/admin/users").send({name:"Duplicate",email:email.toUpperCase(),role:"REQUESTER",isActive:false,initialPassword:PASSWORD});expect(duplicate.status).toBe(409);expect(duplicate.body.error.code).toBe("EMAIL_CONFLICT");
    const stale=await api().patch(`/api/admin/users/${created.body.user.id}`).send({name:"Stale",email:email.toLowerCase(),role:"REQUESTER",isActive:true,expectedVersion:created.body.user.version+1});expect(stale.status).toBe(409);expect(stale.body.error.code).toBe("VERSION_CONFLICT");
  });

  it("revokes sessions and records ACCOUNT_INELIGIBLE provenance when an owner loses eligibility",async()=>{
    const ticket=await createOwnedTicket(staffId);await createTestSession(prisma,staffId);const current=await prisma.requesterUser.findUniqueOrThrow({where:{id:staffId}});
    const changed=await api().patch(`/api/admin/users/${staffId}`).send({name:current.name,email:current.email,role:"REQUESTER",isActive:true,expectedVersion:current.version});expect(changed.status).toBe(200);
    const [saved,events,sessions]=await Promise.all([prisma.ticket.findUniqueOrThrow({where:{id:ticket.id}}),prisma.ticketOwnerChange.findMany({where:{ticketId:ticket.id}}),prisma.session.count({where:{userId:staffId}})]);
    expect(saved).toMatchObject({ticketOwnerId:null,version:2});expect(events).toEqual([expect.objectContaining({previousOwnerId:staffId,nextOwnerId:null,actorId:adminAId,reason:"ACCOUNT_INELIGIBLE"})]);expect(sessions).toBe(0);
  });

  it("serializes competing last-active-admin changes so at least one active Administrator remains",async()=>{
    await prisma.requesterUser.updateMany({where:{role:"ADMINISTRATOR",isActive:true,id:{notIn:[adminAId,adminBId]}},data:{isActive:false,version:{increment:1}}});
    const [a,b]=await Promise.all([prisma.requesterUser.findUniqueOrThrow({where:{id:adminAId}}),prisma.requesterUser.findUniqueOrThrow({where:{id:adminBId}})]);const authB=await createTestSession(prisma,adminBId);const app=createApp(prisma);
    const patch=(session:typeof auth,id:number,body:object)=>request(app).patch(`/api/admin/users/${id}`).set("Cookie",session.cookie).set("Origin",testClientOrigin).set("X-CSRF-Token",session.csrfToken).send(body);
    const results=await Promise.all([patch(auth,adminBId,{name:b.name,email:b.email,role:"REQUESTER",isActive:true,expectedVersion:b.version}),patch(authB,adminAId,{name:a.name,email:a.email,role:"REQUESTER",isActive:true,expectedVersion:a.version})]);
    expect(results.filter(r=>r.status===200)).toHaveLength(1);expect(results.filter(r=>r.status===409&&r.body.error.code==="LAST_ACTIVE_ADMIN")).toHaveLength(1);expect(await prisma.requesterUser.count({where:{role:"ADMINISTRATOR",isActive:true}})).toBe(1);
  });
});
