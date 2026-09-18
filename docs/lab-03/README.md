# Lab 3 Engineering Contract: สรุปและจุดเริ่มทำงาน

จัดทำวันที่ 2026-09-15 และอัปเดต 2026-09-19 สถานะ: **implementation ผ่าน PR #68-#72 แล้ว; product backlog มี 4 umbrella Issues และ 5 independently reviewable Staff child Issues; documentation consolidation #73/PR #74 กำลังรอ re-review**

## งานนี้ทำอะไร

อ่าน Lab_3_sheet.pdf ครบ 18 หน้า รวมภาพตัวอย่างและเกณฑ์ส่งงาน ตรวจโค้ด/เอกสาร Lab 1-2 ของ repository จริง แล้วจัดทำ Engineering Contract ของ Sprint 3, แผนทดสอบที่เชื่อม Acceptance Criteria และแผน Issue เดิม 17 งาน ก่อนจัดเป็น 4 product umbrellas (#56, #58, #63, #65) พร้อม Staff child Issues #59/#60/#61/#62/#75 และ documentation Issue #73

Implementation ที่ merge แล้วครอบคลุม Issue #51-#55 ผ่าน PR #68-#72; งาน #56/#58/#63/#65 ยังเป็น product backlog ตาม Project และ #73 เป็นงาน sync เอกสาร ไม่มีการอ้างว่า Lab 3 เสร็จสมบูรณ์จนกว่าจะมี final evidence/PR/main verification

## เอกสารที่ต้องอ่าน

| ไฟล์ | เนื้อหา |
| --- | --- |
| [specification.md](specification.md) | 11 sections, 25 FR, 40 BR, 32 AC; authorization/status matrices; data migration/provisioning/seed; Product DoD และ project decisions |
| [api-spec.md](api-spec.md) | Exact endpoints/request/response/status, DTOs, session/cookie/CSRF, query/error/concurrency rules |
| [ui-spec.md](ui-spec.md) | Routes/role shell, modes/feedback, screen controls, Zen Green, responsive/accessibility และ visual checklist |
| [tests.md](tests.md) | 63 planned test groups รวม PERF-01, AC traceability, Lab 1/2 regression disposition, isolated database และ final verification rules |
| [implementation-plan.md](implementation-plan.md) | Historical 17-issue plan, current consolidated 4-issue queue, #73 documentation task, dependencies และ branch flow |
| [reviewer.md](reviewer.md) | Historical contract reviews plus implementation/release evidence and remaining peer/release records |
| [ai-use.md](ai-use.md) | Actual prompts, implementation-use record and student reflection; keep the student's own voice |

## Baseline ที่ตรวจพบจริง

- Project: `C:/Users/mos28/Desktop/project/TokTickIT Full-Stack/Lab1/toktickit`
- Repository: [Chxtamos/-TokTickIT-](https://github.com/Chxtamos/-TokTickIT-); เริ่มงานบน `main` commit `439ee7e`, working tree สะอาด
- Stack: React 18/TypeScript/Vite 6/Bootstrap 5; Express 4/TypeScript/Prisma 5/PostgreSQL; Vitest/Supertest/React Testing Library/Playwright
- `server/prisma/schema.prisma`: RequesterUser, Category, RelatedSystem, Ticket, Attachment; priorities LOW/MEDIUM/HIGH/URGENT; TicketStatus มี NEW ค่าเดียว
- `server/src/app.ts`: health/reference/selector, owner-scoped Tickets/files; identity ใช้ temporary `X-Requester-Id`; CORS ยังไม่มี credentialed-origin policy
- `client/src/App.tsx`: Selector/Create/My Tickets/Detail/Attachment/Shell ในไฟล์เดียว; ใช้ `sessionStorage` key `toktickit.requesterId`
- `client/src/api.ts`: ส่ง requester header; Playwright ใช้ `client/e2e` เป็น test directory
- Applied migrations: Lab 1 init, Lab 2 data model และ normalized-requester-email CHECK; ต้องเพิ่ม forward migration โดยไม่แก้ไฟล์ที่ apply แล้ว
- `docs/lab-02` มี specification/API/UI/tests/reviewer/AI; release PR #50 merged เข้า main ตามบันทึก และมี commits ต่อมาเพื่อปรับ PDF evidence
- README/Lab 2 tests ระบุผลเดิม 62 server/54 client/9 E2E passed เป็น historical evidence **ไม่ได้ rerun ในงานเอกสารนี้** และไม่ใช่ Lab 3 results
- Existing PostgreSQL integration ใช้ `RUN_DB_INTEGRATION` กับ `DATABASE_URL`; Playwright มี development fallback จึงต้องแยก test database ก่อนทำ migration tests
- CI ทั้งสาม workflow ปัจจุบัน trigger `main`/`lab2-staging`; งาน foundation จะเพิ่ม `lab3-staging`
- ไม่พบ AGENTS.md ใน repository/parent directories ที่ตรวจ และไม่ได้อ่านหรือแสดง `.env`/private credentials

เปิดอ่านประวัติ task “ทำตาม Lab Sheet 2” และ “อ่านโปรเจคเพื่อตอบคำถาม” ใน Software eng เพื่อประกอบ context ประวัติบางส่วนเป็นการ review repository ของเพื่อน จึงใช้โค้ด/เอกสารของ Chxtamos เป็น baseline จริง และเขียน contract นี้จาก Lab sheet กับโปรเจคนี้

## จุดสำคัญที่เลือกไว้ใน contract

1. Rename RequesterUser -> User โดยรักษา IDs, Ticket requester/remover links และ Attachment bytes เปลี่ยน identity เป็น session โดยไม่ล้างข้อมูล Lab 2
2. Login email/password, proposed built-in scrypt profile ที่ต้องผ่าน PERF-01 บน local/CI ก่อน freeze, opaque database sessions และ idempotent logout204; initial-password session หมดอายุคงที่ 15 นาทีโดย activity ไม่ต่ออายุ และ password update/revoke/replacement session commit atomically ก่อน Set-Cookie
3. ออกรหัสเริ่มต้นให้บัญชี Lab 2 ผ่าน interactive CLI: random ต่อคน, แสดงครั้งเดียว, เก็บ hash, manual delivery และ rerun ไม่ reset credentials/activation
4. User มี role เดียว Administrator ทำ User Management และ staff operations ได้ตาม matrix ที่ระบุชัด ซึ่ง Lab sheet อนุญาตเมื่อ contract กำหนดไว้
5. Ticket Owner คนเดียว, claim/assign/reassign โดยไม่มี Staff manual unassign, IT Priority แยก Requested Priority, 8-status matrix และ expectedVersion ป้องกัน stale/concurrent writes; account-driven cleanup บน CLOSED/CANCELLED เก็บ former owner ใน TicketOwnerChange; Requester เพียงแจ้ง Problem Appears Resolved
6. Public Comments/Internal Notes แยก model/service/endpoint/composer; append-only, backend author/time, plain text; ไม่มี backend conversation request-key deduplication ใน Lab 3 และ UI ให้ตรวจรายการก่อน retry เมื่อผลกำกวม ไม่เปิด Note content/count ให้ Requester
7. Admin UI แบบ minimal: list/search/optional role/create/edit/activate/reset; ป้องกัน self-deactivation/last-active-admin แม้ concurrent ไม่เพิ่ม delete/email/bulk/history
8. คง Zen Green/read-only submitted Ticket/owner Attachment behavior; แยก test DB ก่อน migration และปรับ Lab 2 regression tests ให้ใช้ authentication

รายละเอียดเหล่านี้ควรตรวจตอน review contract การระบุ decision ไม่ใช่การอ้างว่า implementation ผ่านแล้ว

## งานถัดไป

Issues เดิม #51-#67 ถูกสร้างจาก implementation-plan.md และถูกเก็บเป็น traceability ปัจจุบัน Issue #51-#55 Done, #56 Started, #58/#59/#60/#61/#62/#63/#65/#75 Backlog และ #73 Started ใน Project #6; PR #68-#72 merged/recorded ตาม GitHub state ล่าสุด. งาน Staff ใช้ child flow #59/#62/#60/#61/#75 โดยแต่ละ Issue ต้องมี feature branch และ PR ของตัวเองเข้า `lab3-staging` ก่อนรวม evidence ใน #65

## สถานะและ document validation

Contract/implementation evidence: PR #68-#72 มี review/merge/CI records ตาม GitHub และ `tests.md`; remaining product/UI/release evidence ยังไม่ครบ. Product DoD: Incomplete. Active Issues: [#56](https://github.com/Chxtamos/-TokTickIT-/issues/56), umbrella [#58](https://github.com/Chxtamos/-TokTickIT-/issues/58), child [#59](https://github.com/Chxtamos/-TokTickIT-/issues/59)/[#62](https://github.com/Chxtamos/-TokTickIT-/issues/62)/[#60](https://github.com/Chxtamos/-TokTickIT-/issues/60)/[#61](https://github.com/Chxtamos/-TokTickIT-/issues/61)/[#75](https://github.com/Chxtamos/-TokTickIT-/issues/75), [#63](https://github.com/Chxtamos/-TokTickIT-/issues/63), [#65](https://github.com/Chxtamos/-TokTickIT-/issues/65), documentation [#73](https://github.com/Chxtamos/-TokTickIT-/issues/73)

ตรวจเอกสารก่อน commit: FR/BR/AC numbering, AC coverage/index, referenced Test IDs, issue count/dependencies, local Markdown links, API/workflow/role/password consistency และ `git diff --check` การตรวจเหล่านี้เป็น document validation ไม่ใช่ runtime/security/migration test passes
