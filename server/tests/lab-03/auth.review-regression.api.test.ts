import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createHash, randomUUID } from "node:crypto";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";
import { hashPassword } from "../../src/password.js";
import { resetLoginThrottle, type AuthPrisma } from "../../src/auth.js";

const origin = "http://127.0.0.1:5173";
const password = "review regression password";

type User = { id:number; name:string; email:string; role:"REQUESTER"; isActive:boolean; passwordHash:string|null; mustChangePassword:boolean; passwordChangedAt:Date|null; version:number; createdAt:Date; updatedAt:Date };
type Session = { id:string; tokenHash:string; userId:number; csrfToken:string; createdAt:Date; lastSeenAt:Date; expiresAt:Date; user:User };

function makePrisma(user: User) {
  const sessions: Session[] = [];
  const prisma:any = {
    requesterUser: {
      findUnique: vi.fn(async (args:any) => args.where.email !== undefined ? (args.where.email === user.email ? user : null) : (args.where.id === user.id ? user : null)),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    session: {
      findUnique: vi.fn(async (args:any) => sessions.find((s) => args.where.id !== undefined ? s.id === args.where.id : s.tokenHash === args.where.tokenHash) ?? null),
      create: vi.fn(async (args:any) => { const s = { id: randomUUID(), ...args.data, user } as Session; sessions.push(s); return s; }),
      update: vi.fn(async (args:any) => { const s=sessions.find((x)=>x.id===args.where.id)!; Object.assign(s,args.data); return s; }),
      deleteMany: vi.fn(async (args:any) => { const before=sessions.length; for(let i=sessions.length-1;i>=0;i--){const s=sessions[i]; if((args.where?.tokenHash===undefined||s.tokenHash===args.where.tokenHash)&&(args.where?.userId===undefined||s.userId===args.where.userId)) sessions.splice(i,1);} return {count:before-sessions.length}; }),
    },
    $transaction: vi.fn(async (cb:any)=>cb(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return { prisma: prisma as AuthPrisma, sessions };
}

function user(hash:string|null, mustChangePassword=false):User { const now=new Date("2026-09-17T00:00:00Z"); return {id:1,name:"Review User",email:"review@example.test",role:"REQUESTER",isActive:true,passwordHash:hash,mustChangePassword,passwordChangedAt:null,version:1,createdAt:now,updatedAt:now}; }
function app(prisma:AuthPrisma){ return createApp(prisma as unknown as ReferenceDataPrisma); }
function cookie(res:request.Response){ return res.headers["set-cookie"][0].split(";",1)[0]; }
function exactBody(base:Record<string,unknown>, bytes:number){ const empty=JSON.stringify({...base,padding:""}); return JSON.stringify({...base,padding:"x".repeat(bytes-Buffer.byteLength(empty))}); }

describe("Lab 3 auth reviewer regressions",()=>{
  let hash:string; const previous=process.env.CLIENT_ORIGIN;
  beforeAll(async()=>{ hash=await hashPassword(password); });
  beforeEach(()=>{ process.env.CLIENT_ORIGIN=origin; resetLoginThrottle(); });
  afterAll(()=>{ if(previous===undefined) delete process.env.CLIENT_ORIGIN; else process.env.CLIENT_ORIGIN=previous; });

  it("blocks restricted sessions from normal APIs with PASSWORD_CHANGE_REQUIRED", async()=>{
    const f=makePrisma(user(hash,true)); const a=app(f.prisma);
    const login=await request(a).post("/api/auth/login").set("Origin",origin).send({email:"review@example.test",password});
    expect(login.status).toBe(200); const c=cookie(login);
    for(const path of ["/api/categories","/api/tickets","/api/tickets/1/attachments"]){ const r=await request(a).get(path).set("Cookie",c).set("X-Requester-Id","1"); expect(r.status).toBe(403); expect(r.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED"); }
    expect((await request(a).get("/api/health").set("Cookie",c)).status).toBe(200);
  });

  it("enforces the thirty-failure IP window and resets after fifteen minutes", async()=>{
    vi.useFakeTimers();
    try { vi.setSystemTime(new Date("2026-09-17T00:00:00Z")); const f=makePrisma(user("malformed-hash")); const a=app(f.prisma);
      for(let i=0;i<30;i++){ f.prisma.requesterUser.findUnique = vi.fn(async()=>({ ...user("malformed-hash"), email:`review-${i}@example.test` })) as any; const r=await request(a).post("/api/auth/login").set("Origin",origin).send({email:`review-${i}@example.test`,password:"wrong password"}); expect(r.status).toBe(401); }
      const limited=await request(a).post("/api/auth/login").set("Origin",origin).send({email:"review-next@example.test",password:"wrong password"}); expect(limited.status).toBe(429); expect(limited.headers["retry-after"]).toBe("900");
      vi.advanceTimersByTime(15*60*1000); f.prisma.requesterUser.findUnique = vi.fn(async()=>({ ...user("malformed-hash"), email:"review-next@example.test" })) as any;
      expect((await request(a).post("/api/auth/login").set("Origin",origin).send({email:"review-next@example.test",password:"wrong password"})).status).toBe(401);
    } finally { vi.useRealTimers(); }
  });

  it("sets Secure for HTTPS and omits it for explicit local HTTP", async()=>{
    const f=makePrisma(user(hash)); const a=app(f.prisma);
    const local=await request(a).post("/api/auth/login").set("Origin",origin).send({email:"review@example.test",password}); expect(local.status).toBe(200); expect(local.headers["set-cookie"][0]).not.toMatch(/; Secure(?:;|$)/);
    await request(a).post("/api/auth/logout").set("Origin",origin).set("Cookie",cookie(local)).set("X-CSRF-Token",local.body.csrfToken);
    const https=await request(a).post("/api/auth/login").set("Origin",origin).set("X-Forwarded-Proto","https").send({email:"review@example.test",password}); expect(https.status).toBe(200); expect(https.headers["set-cookie"][0]).toMatch(/; Secure(?:;|$)/);
  });

  it("accepts the 16 KiB boundary for parsing and rejects one byte over it", async()=>{
    const f=makePrisma(user(hash)); const a=app(f.prisma); const base={email:"review@example.test",password};
    const at=exactBody(base,16*1024); expect(Buffer.byteLength(at)).toBe(16*1024); const accepted=await request(a).post("/api/auth/login").set("Origin",origin).set("Content-Type","application/json").send(at); expect(accepted.status).toBe(400); expect(accepted.body.error.fieldErrors.padding).toBeDefined();
    const over=exactBody(base,16*1024+1); expect(Buffer.byteLength(over)).toBe(16*1024+1); const rejected=await request(a).post("/api/auth/login").set("Origin",origin).set("Content-Type","application/json").send(over); expect(rejected.status).toBe(400); expect(rejected.body.error.fieldErrors.body[0]).toMatch(/16 KiB/);
  });
});
