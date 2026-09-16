# Lab 3 Implementation Plan and Ready-to-Create Issues

จัดทำวันที่ 2026-09-15 จาก Lab sheet และโค้ด Lab 2 ของโปรเจคนี้ มีแผนทั้งหมด **17 Issues** ซึ่งสร้างบน GitHub แล้วเป็น #51-#67 เลข 01-17 เป็นลำดับแผน ไม่ใช่ GitHub Issue number Contract PR คือ #68

## GitHub Issues created

| Plan | GitHub Issue | Title |
| --- | --- | --- |
| 01 | [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51) | Lab 3: Define engineering contract, acceptance criteria and test plan |
| 02 | [#52](https://github.com/Chxtamos/-TokTickIT-/issues/52) | Lab 3: Isolate PostgreSQL test data and extend staging CI |
| 03 | [#53](https://github.com/Chxtamos/-TokTickIT-/issues/53) | Lab 3: Migrate Requester accounts, provision passwords and seed workflow data |
| 04 | [#54](https://github.com/Chxtamos/-TokTickIT-/issues/54) | Lab 3: Implement login, password change, sessions and logout APIs |
| 05 | [#55](https://github.com/Chxtamos/-TokTickIT-/issues/55) | Lab 3: Enforce role authorization and preserve Requester Ticket/Attachment APIs |
| 06 | [#56](https://github.com/Chxtamos/-TokTickIT-/issues/56) | Lab 3: Build Login, mandatory Change Password and authenticated role shell |
| 07 | [#57](https://github.com/Chxtamos/-TokTickIT-/issues/57) | Lab 3: Preserve Requester screens and add Public Comments/resolution indication |
| 08 | [#58](https://github.com/Chxtamos/-TokTickIT-/issues/58) | Lab 3: Implement shared IT Staff queue search, filters, sorting and pagination |
| 09 | [#59](https://github.com/Chxtamos/-TokTickIT-/issues/59) | Lab 3: Build responsive IT Staff Ticket Queue |
| 10 | [#60](https://github.com/Chxtamos/-TokTickIT-/issues/60) | Lab 3: Implement Ticket ownership, IT Priority and status workflow APIs |
| 11 | [#61](https://github.com/Chxtamos/-TokTickIT-/issues/61) | Lab 3: Implement Public Comments and restricted Internal Notes APIs |
| 12 | [#62](https://github.com/Chxtamos/-TokTickIT-/issues/62) | Lab 3: Build operational Ticket Detail with distinct Public/Private communication |
| 13 | [#63](https://github.com/Chxtamos/-TokTickIT-/issues/63) | Lab 3: Implement minimalist Administrator User Management APIs and safety rules |
| 14 | [#64](https://github.com/Chxtamos/-TokTickIT-/issues/64) | Lab 3: Build minimalist Administrator User Management screen |
| 15 | [#65](https://github.com/Chxtamos/-TokTickIT-/issues/65) | Lab 3: Verify authenticated Requester, IT Staff and Administrator end-to-end flows |
| 16 | [#66](https://github.com/Chxtamos/-TokTickIT-/issues/66) | Lab 3: Complete Zen Green, accessibility and responsive visual evidence |
| 17 | [#67](https://github.com/Chxtamos/-TokTickIT-/issues/67) | Lab 3: Finalize reviewed staging release, main verification and nine-part PDF |

## ลำดับการทำงาน

1. ตรวจและรีวิว contract (01) ให้สอดคล้องกันก่อน implementation ที่พึ่งพาข้อกำหนดนั้น
2. แยกฐานข้อมูลทดสอบและปรับ CI (02) -> migration/provisioning/seed (03) -> authentication API (04) -> authorization และ Requester API regression (05)
3. ทำ Login/Change Password/authenticated shell (06) และ Requester UI (07); งาน 07 ต้องรอ Public Comments API จาก 11 ก่อนปิดงาน
4. ทำ Queue API (08) -> Queue UI (09); Ticket operations API (10) และ conversations API (11) -> Staff Detail UI (12)
5. ทำ Admin API (13) -> Admin UI (14); งาน 13 พึ่งพากฎ owner/version จาก 10 เพื่อทดสอบการเปลี่ยน role ที่เกิดพร้อมการ assign ได้จริง
6. รวม E2E/regression/security (15) -> responsive/accessibility/visual evidence (16) -> final verification/review/release/PDF (17)

แต่ละงานเพิ่มหรือปรับ planned tests ก่อนหรือพร้อม implementation ตาม Test DD/TDD และเชื่อม FR/BR/AC ใน PR ไม่รอสร้างแผนทดสอบจากโค้ดที่เขียนเสร็จแล้ว

## Branch และ review flow

- งาน contract นี้ใช้ `feature/24-lab3-engineering-contract` จาก baseline `main`; `lab3-staging` ตั้งต้นจาก main เดียวกัน ทั้งคู่ถูก push แล้ว
- งานถัดไปใช้ Feature number ต่อจาก 24 เช่น Issue #52 -> `feature/25-lab3-test-isolation-ci` จาก latest `lab3-staging` GitHub Issue number กับ Feature number ไม่เท่ากัน
- สร้าง feature PR -> `lab3-staging`, เชื่อม Issue จริงผ่าน GitHub Development relationship, ตรวจ tests/CI/evidence และให้เพื่อนรีวิวก่อน merge ตั้ง Issue ที่เริ่มทำเป็น Started และ PR เป็น PR Review ใน Project #6; งานอื่นคง Backlog
- Release PR จาก `lab3-staging` -> `main`; เก็บ merge history แล้วตรวจ final main เพื่อใช้เป็นหลักฐานส่งงาน
- ใช้ Kanban statuses จริงของ [Project #6](https://github.com/users/Chxtamos/projects/6): Issue #51 Started, #52-#67 Backlog และ PR #68 PR Review ณ รอบแก้ feedback นี้ ตรวจกลับหลังเปิด PR เพราะ automation อาจเปลี่ยน Issue เป็น Fixing; ไป Done เมื่อ review/merge/evidence ครบตาม Lab sheet
- เพิ่ม `lab3-staging` ใน trigger ของ CI ทั้งสาม workflow ในงาน 02 งาน contract นี้ยังไม่แก้ runtime/schema/CI

## Issue 01
GitHub: [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51)

**Title:** Lab 3: Define engineering contract, acceptance criteria and test plan

**Description:**

จัดทำ Sprint 3 engineering contract ก่อนเขียนฟีเจอร์ โดยอ่าน Lab 3 ทุกหน้าและตรวจ baseline Lab 1/2 จาก repository จริง ระบุ scope/exclusions, numbered FR/BR/AC, authorization matrix, workflow 8 สถานะ, migration/initial-password provisioning, exact API request/response/status, Zen Green UI, planned tests และ Product Definition of Done

Deliverables: `docs/lab-03/specification.md`, `docs/lab-03/api-spec.md`, `docs/lab-03/ui-spec.md`, `docs/lab-03/tests.md`, `docs/lab-03/README.md`, `docs/lab-03/implementation-plan.md`, `docs/lab-03/reviewer.md` และ `docs/lab-03/ai-use.md` ตรวจ cross-reference, traceability และลิงก์ พร้อมบันทึก approval จากนักศึกษา/peer จริง การเตรียมเอกสารไม่ใช่ Lab 3 product completion

Acceptance/evidence: FR-01-25; AC-01-32 มี planned coverage ครบ; contract มีอยู่ก่อน main implementation PRs เสร็จ; diff เฉพาะเอกสารและ document validation ผ่าน

Prerequisite: Lab 2 baseline บน main สถานะปัจจุบัน: Issue [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51), branch push และ PR [#68](https://github.com/Chxtamos/-TokTickIT-/pull/68) สร้างแล้ว; GitHub Development relationship เชื่อม PR ↔ Issue แบบ manual closing reference, Project Issue = Started และ PR = PR Review; รอ re-review/approval จริง การ merge เข้า staging ไม่รับประกัน auto-close บน default main ให้ปิด Issue และตั้ง Done เมื่อมีหลักฐาน review/merge ครบ

## Issue 02
GitHub: [#52](https://github.com/Chxtamos/-TokTickIT-/issues/52)

**Title:** Lab 3: Isolate PostgreSQL test data and extend staging CI

**Description:**

ปรับ existing database integration tests และ Playwright ที่ใช้ `DATABASE_URL` หรือ development fallback ให้ใช้ `TEST_DATABASE_URL` ที่ตรวจสอบก่อน Prisma initialization/migrate/seed แยก test database และ Attachment directory จาก development ห้าม fallback เมื่อ config ขาด Guard ตรวจ PostgreSQL URL, ชื่อฐานข้อมูลที่มี test และ canonical database target equality โดยไม่เปิดเผย credentials; schema ต่างกันใน database เดิมไม่ถือว่าแยกได้

แยก pure unit/mock mode ออกจาก full verification ที่ห้าม skip required integration ปรับ `.env.example`/README และ Server/Client/E2E CI ให้ตรวจ `lab3-staging` พร้อม `main`; ใช้ synthetic test credentials และเก็บ output ที่ไม่มี secrets

Acceptance/tests: BR-40, AC-31; UNIT-05 และ fixture/setup smoke checks บน isolated target; pure tests ยังรันโดยไม่มี DB ได้ ส่วน full integration ที่ config ไม่ปลอดภัยต้อง fail ก่อน write

Dependencies: [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51)

## Issue 03
GitHub: [#53](https://github.com/Chxtamos/-TokTickIT-/issues/53)

**Title:** Lab 3: Migrate Requester accounts, provision passwords and seed workflow data

**Description:**

เพิ่ม forward migrations จาก Lab 2: rename `RequesterUser` -> `User` โดยรักษา IDs/FKs; เพิ่ม role/password/account state, Session, Ticket owner/IT Priority/version/resolution/indication, TicketOwnerChange provenance และแยก PublicComment/InternalNote พร้อม constraints/indexes ห้ามแก้ applied migrations หรือล้างข้อมูลเดิม Throttle ใช้ bounded process memory ใน local lab จึงไม่มี LoginThrottle table

ทำ interactive `lab3:provision-migrated-users` CLI ตาม contract: random initial password ต่อบัญชีที่ hash ยัง NULL, เก็บ salted hash, แสดงครั้งเดียวหลัง commit และไม่ redirect/log; รักษา activation และ rerun ไม่ reset credentials ทำ creation-only idempotent seed ตามจำนวนบัญชีขั้นต่ำและ 24 Tickets ครบสถานะ/priority/assignment พร้อม safe Comments/Notes อธิบาย local credentials/manual delivery ใน README

Acceptance/tests: FR-06/23, AC-07/08/09; DB-01-03, UNIT-01/02 ที่เกี่ยวกับ hash; เปรียบเทียบ counts/IDs/ownership/removal attribution/sequence/file hashes และ repeated provisioning/seed ที่ไม่ทับงานเดิม

Dependencies: [#51](https://github.com/Chxtamos/-TokTickIT-/issues/51), [#52](https://github.com/Chxtamos/-TokTickIT-/issues/52)

## Issue 04
GitHub: [#54](https://github.com/Chxtamos/-TokTickIT-/issues/54)

**Title:** Lab 3: Implement login, password change, sessions and logout APIs

**Description:**

ทำ login/me/change-password/logout ตาม `api-spec.md` โดยรัน PERF-01 บน local/CI runtimes ก่อน freeze scrypt profile; ใช้ opaque PostgreSQL sessions/cookie, restricted first-login session ที่หมดอายุคงที่ 15 นาทีโดย activity ไม่ต่ออายุ, normal absolute/idle expiry, atomic password update+session revoke+replacement persist ก่อน Set-Cookie, idempotent logout204, exact Origin/credentialed CORS/CSRF และ bounded in-memory fixed-window throttleสำหรับ local lab

ใช้ safe feedback แบบเดียวกันสำหรับ unknown email/wrong password/inactive/unprovisioned accounts ไม่ return/log credentials ตรวจ current/new/confirm password และการ invalidate sessions ตาม contract

Acceptance/tests: FR-01-04, BR-01/02/07-15, AC-01-05/27/28; UNIT-01/02, PERF-01, API-01-05/09-11/34 รวม restricted-session before/exact/after boundary กับ no-extension, transaction fault rollback, post-commit recovery, absent-session logout204, token replay, normal expiry, cookie flags และ CSRF; multipart จะตรวจร่วมกับงาน 05

Dependencies: [#53](https://github.com/Chxtamos/-TokTickIT-/issues/53)

## Issue 05
GitHub: [#55](https://github.com/Chxtamos/-TokTickIT-/issues/55)

**Title:** Lab 3: Enforce role authorization and preserve Requester Ticket/Attachment APIs

**Description:**

เพิ่ม middleware/service guards ตามทุกแถวของ authorization matrix ใช้ authenticated User ID แทน temporary requester header ป้องกัน initial-password/wrong-role/non-owner ด้วย 401/403/404 ที่ถูกต้อง Remove Development Requester endpoint แล้วปรับ create/list/detail/reference/Attachment APIs โดยรักษา validation, Ticket numbering, idempotency, pagination, file checks และ soft removal

ปรับ existing Lab 1/2 server tests เป็น sessions/User delegates พร้อมระบุ selector tests ที่ retire เพิ่ม owner-only resolution-indication endpoint และป้องกัน Private Note ผ่าน Requester projections Staff/Admin อ่าน/download ไฟล์ได้ แต่ upload/remove ไม่ได้ตาม matrix

Acceptance/tests: FR-05-09, AC-06/09-11/18/20/28; API-06-08/12-17/26, PostgreSQL regression และ CSRF multipart upload

Dependencies: [#54](https://github.com/Chxtamos/-TokTickIT-/issues/54)

## Issue 06
GitHub: [#56](https://github.com/Chxtamos/-TokTickIT-/issues/56)

**Title:** Lab 3: Build Login, mandatory Change Password and authenticated role shell

**Description:**

เพิ่ม Login/Change Password ตาม Zen Green พร้อม labels, policy/current/confirm validation, busy, generic credential/inactive feedback, rate-limit/expiry และ secret clearing ทำ me bootstrap, role landing/navigation/direct guards, no protected-content flash, logout retry และ account-state cleanup

ล้าง legacy `toktickit.requesterId`, นำ selector/Change Requester ออก และปรับ client fetch เป็น credentials=include/CSRF ใน memory ไม่เก็บ session credentials ใน browser storage Abort/discard pending responses หลัง logout/new login และให้ refresh/back/direct routes ทำงานถูกต้อง

Acceptance/tests: FR-02-06/21/22, AC-01-06/11/27/28/30; UI-01-03, A11Y-01 ที่เกี่ยวข้อง และ authentication E2E ในงาน 15

Dependencies: [#54](https://github.com/Chxtamos/-TokTickIT-/issues/54), [#55](https://github.com/Chxtamos/-TokTickIT-/issues/55)

## Issue 07
GitHub: [#57](https://github.com/Chxtamos/-TokTickIT-/issues/57)

**Title:** Lab 3: Preserve Requester screens and add Public Comments/resolution indication

**Description:**

ย้าย Create Ticket/My Tickets/Requester Detail/Attachment UI เดิมให้ใช้ authenticated identity และรักษาพฤติกรรม Lab 2 เพิ่ม status filters 8 ค่า, read-only IT Priority, Public Comments composer/list/retry และ Problem Appears Resolved confirmation/indicator ห้าม Requester set Resolved/Closed หรือเห็น Internal Note tab/count

ปรับ existing client/E2E expectations ตาม regression disposition โดยไม่ตัด substantive Ticket/file tests เพื่อให้ผ่าน รักษา partial upload retry, backend number/date/request key, read-only submitted fields และ removed metadata

Acceptance/tests: FR-07-09/15/21/22, AC-09-11/18-21/28/30; UI-04/07, E2E-02 และ preserved Lab 2 coverage

Dependencies: [#55](https://github.com/Chxtamos/-TokTickIT-/issues/55), [#56](https://github.com/Chxtamos/-TokTickIT-/issues/56), [#61](https://github.com/Chxtamos/-TokTickIT-/issues/61); ปิดงานหลัง Public Comments API จาก 11 พร้อม

## Issue 08
GitHub: [#58](https://github.com/Chxtamos/-TokTickIT-/issues/58)

**Title:** Lab 3: Implement shared IT Staff queue search, filters, sorting and pagination

**Description:**

ทำ shared queue และ minimal eligible-owner APIs ตาม exact query/DTO มี search Ticket Number/Summary, AND filters Category/System/Requested Priority/IT Priority/Status/Owner, owner All/Unassigned/Mine/specific user, deterministic ordering/priority rank และ page sizes 10/20/50

Reject unknown/repeated/unsafe-offset/invalid parameters ด้วย 400; beyond-end คืน empty items พร้อม accurate metadata ห้าม Requester เข้า staff endpoints และไม่ concatenate query values ลง raw SQL

Acceptance/tests: FR-10, AC-06/12; UNIT-04, API-18/19 รวม real PostgreSQL query/filter/order/tie-breaker behavior

Dependencies: [#55](https://github.com/Chxtamos/-TokTickIT-/issues/55)

## Issue 09
GitHub: [#59](https://github.com/Chxtamos/-TokTickIT-/issues/59)

**Title:** Lab 3: Build responsive IT Staff Ticket Queue

**Description:**

ทำ Queue ด้วย reusable Zen Green มี desktop table ที่อ่านได้และ mobile cards, search/filter panel/sort/pagination พร้อม reset page/Clear Filters, priority/status badges, assigned/unassigned owner และ Open Detail

แยก loading/empty/no-results/forbidden/failure/beyond-end feedback และ recovery รักษา query ของ account เดียวเมื่อกลับจาก detail และให้ keyboard/touch controls ใช้งานได้

Acceptance/tests: FR-10/21/22, AC-12/13/29/30; UI-05, STYLE-01, A11Y-01 และ queue browser flow

Dependencies: [#56](https://github.com/Chxtamos/-TokTickIT-/issues/56), [#58](https://github.com/Chxtamos/-TokTickIT-/issues/58)

## Issue 10
GitHub: [#60](https://github.com/Chxtamos/-TokTickIT-/issues/60)

**Title:** Lab 3: Implement Ticket ownership, IT Priority and status workflow APIs

**Description:**

ทำ operational detail/claim/assign/reassign/IT Priority/status ตาม exact API และ transition matrix 8 สถานะ ใช้ expectedVersion atomic writes, eligible-owner checks, TicketOwnerChange append-only provenance, no-op/terminal staff rules และ assignment/account coordination locks ตัด Staff manual unassign ออกจาก Lab 3; account-driven owner cleanup เป็น path เดียวที่ clear owner และเป็นกฎแยกจาก staff mutation

ขอ public resolution summary ตอน Resolved และ public reason ตอน Reopened/Cancelled ใช้ backend timestamps และ reset indication/resolution ตอน reopen รักษา Requested Priority/submitted fields/Attachments ไม่ทำ Actions Taken หรือใช้เป็นเงื่อนไข resolution

Acceptance/tests: FR-11-14, AC-14-18/24; UNIT-03, API-20-25/22 และ real concurrency รวม null/manual-unassign rejection; ตรวจ assignment/demotion race ใน DB-04 ร่วมกับงาน 13

Dependencies: [#55](https://github.com/Chxtamos/-TokTickIT-/issues/55), [#58](https://github.com/Chxtamos/-TokTickIT-/issues/58)

## Issue 11
GitHub: [#61](https://github.com/Chxtamos/-TokTickIT-/issues/61)

**Title:** Lab 3: Implement Public Comments and restricted Internal Notes APIs

**Description:**

ทำ separate Comment/Note services/endpoints/projections ตาม parent ownership และ role matrix ใช้ trimmed content 1-5000, backend author/time, plain-text data, chronological lists และ append-only POST201 ไม่มี backend conversation request-key replay/deduplication ใน Lab 3; client แสดง feedback เมื่อผลโพสต์กำกวมเพื่อให้ตรวจรายการก่อน retry

ห้าม Requester เข้าถึง Note content/metadata/count ผ่าน direct API/detail/errors Comments/Notes ใช้ได้ทุก Ticket status โดยไม่เปลี่ยน workflow และห้าม edit/delete

Acceptance/tests: FR-15/16, AC-19-21/28; UNIT-06, API-08/27/28/34 และ PostgreSQL append semantics, chronological ordering, terminal-state access, ambiguous-retry list refresh และ parent/projection isolation tests

Dependencies: [#55](https://github.com/Chxtamos/-TokTickIT-/issues/55)

## Issue 12
GitHub: [#62](https://github.com/Chxtamos/-TokTickIT-/issues/62)

**Title:** Lab 3: Build operational Ticket Detail with distinct Public/Private communication

**Description:**

ต่อยอด detail Lab 2 ให้ submitted fields read-only มี Claim/Assign/Reassign, IT Priority, permitted status choices/confirmation/required summary/reason, Requester indication และ staff Attachment download

แยก Public Comments กับ Internal Notes ด้วย headings/visibility hints/independent drafts/buttons ใช้ loaded version, authoritative save response, busy controls และ 409 Refresh/review ที่ไม่ overwrite งานคนอื่น ไม่มี Service Actions และไม่ให้ tab switching ทำให้ post ผิด privacy destination

Acceptance/tests: FR-11-16/21/22, AC-14-17/20/21/28-30; UI-06/07, STYLE-01, A11Y-01 และ E2E-03

Dependencies: [#56](https://github.com/Chxtamos/-TokTickIT-/issues/56), [#59](https://github.com/Chxtamos/-TokTickIT-/issues/59), [#60](https://github.com/Chxtamos/-TokTickIT-/issues/60), [#61](https://github.com/Chxtamos/-TokTickIT-/issues/61)

## Issue 13
GitHub: [#63](https://github.com/Chxtamos/-TokTickIT-/issues/63)

**Title:** Lab 3: Implement minimalist Administrator User Management APIs and safety rules

**Description:**

ทำ admin list/name-email search/optional role filter/create/full basic edit/initial-password reset ตาม exact DTO/status ใช้ one role, normalized unique email, Boolean activation และ expectedVersion ทำ session revocation/lost-owner-eligibility unassignment ใน transaction เดียว พร้อมรักษา historical requester/author/remover links

ป้องกัน self-deactivation และ last-active-admin demotion/deactivation แม้ concurrent writes เพิ่ม self-update/reset reauthenticationRequired และ hash-only initial password/manual delivery Account-driven cleanup ต้อง unassign owner ทุก status รวม CLOSED/CANCELLED และบันทึก TicketOwnerChange ก่อน clear owner โดยคง status/resolution/Requester/history links ไม่ทำ deletion/bulk/import/export/account-history screen/email หรือ advanced list features

Acceptance/tests: FR-17-20, AC-22-26/28; API-29-33, DB-04 และ real PostgreSQL duplicate-email/last-admin/assignment-race checks

Dependencies: [#54](https://github.com/Chxtamos/-TokTickIT-/issues/54), [#55](https://github.com/Chxtamos/-TokTickIT-/issues/55), [#60](https://github.com/Chxtamos/-TokTickIT-/issues/60)

## Issue 14
GitHub: [#64](https://github.com/Chxtamos/-TokTickIT-/issues/64)

**Title:** Lab 3: Build minimalist Administrator User Management screen

**Description:**

ทำ screen เดียวพร้อม Name/Email/Role/Status/Edit, name-email search และ optional role filter มี Create/Edit panel ที่เลือก role เดียว, activation และ separate initial-password reset confirmation

แสดง duplicate/invalid/stale/admin-safety errors, clear secrets/manual delivery hint และ self reauthentication ให้ถูกต้อง ไม่เพิ่ม extended profile/delete/email/bulk features มี responsive cards/dialog, keyboard access และ loading/empty/no-results/busy/success/failure feedback

Acceptance/tests: FR-17-22, AC-22-26/28-30; UI-08/09, STYLE-01, A11Y-01 และ E2E-04

Dependencies: [#56](https://github.com/Chxtamos/-TokTickIT-/issues/56), [#63](https://github.com/Chxtamos/-TokTickIT-/issues/63)

## Issue 15
GitHub: [#65](https://github.com/Chxtamos/-TokTickIT-/issues/65)

**Title:** Lab 3: Verify authenticated Requester, IT Staff and Administrator end-to-end flows

**Description:**

ตรวจ real browser/API/PostgreSQL flows บน isolated fixtures: valid/invalid/inactive/first-change/logout; Requester Ticket/files/comments/indication/A-B ownership; staff queue/claim/reassign/priority/status/Public/Private/file download; admin create/edit/activate/reset/session revocation

รวม direct API role/owner denial และ Note leakage checks ผ่าน Requester API/UI ปรับ existing Lab 2 E2E setup เป็น login และคง Ticket/Attachment coverage Full runs ห้าม required skips ควบคุม fixture cleanup/trace redaction และเก็บ actual commands/counts/results paths

Acceptance/tests: FR-24, AC-01-28/31; E2E-01-04 และ affected API/PostgreSQL/client regression suites

Dependencies: [#57](https://github.com/Chxtamos/-TokTickIT-/issues/57), [#59](https://github.com/Chxtamos/-TokTickIT-/issues/59), [#62](https://github.com/Chxtamos/-TokTickIT-/issues/62), [#64](https://github.com/Chxtamos/-TokTickIT-/issues/64)

## Issue 16
GitHub: [#66](https://github.com/Chxtamos/-TokTickIT-/issues/66)

**Title:** Lab 3: Complete Zen Green, accessibility and responsive visual evidence

**Description:**

ตรวจทุก major screen: Login/Change Password/Requester Create/List/Detail/Staff Queue/Detail/User Management ที่ desktop 1440, tablet 768, mobile 390, narrow 360px และ 200% zoom Capture validation/busy/failure/conflict/role states, Public vs Private, removed Attachments และ admin safety

เก็บ readable screenshots ตาม `artifacts/lab-03/screenshots/` พร้อม human inspection เรื่อง keyboard/focus/contrast/clipping/overlap/overflow ตรวจไม่มี passwords/session credentials/connection secrets หรือ Internal Note บน Requester screen ไม่ใช้ DOM class tests แทน human visual checks

Acceptance/tests: FR-21/22/24, AC-13/21/28-30; STYLE-01, A11Y-01, RESP-01, VIS-01 และ actual human inspection record

Dependencies: [#65](https://github.com/Chxtamos/-TokTickIT-/issues/65)

## Issue 17
GitHub: [#67](https://github.com/Chxtamos/-TokTickIT-/issues/67)

**Title:** Lab 3: Finalize reviewed staging release, main verification and nine-part PDF

**Description:**

ตรวจ Product DoD ด้วย evidence จริงบน staging ให้ peer review release PR -> main แล้วตรวจ final main revision ด้วย complete unit/API/PostgreSQL/UI/authorization/regression/E2E/build/migration evidence อัปเดต tests.md ด้วย actual paths/counts/status และ zero required skips รวม README/.gitignore/setup/provisioning และ reviewer.md ที่มี review comments/responses/approvals จริง

ให้ทุก Issue/Project ไป Done เมื่อครบเกณฑ์ ทำ ai-use.md จาก actual 6-10 prompts/LLM setting และ My Reflection ของนักศึกษาเอง ผลิต PDF เดียว Answer Part 1-9: Git workflow 10, Spec 5, Tests 10, AI 5, Auth 5, Queue 5, Detail 10, Admin 5, Zen Green 5 รวม 60 คะแนน ใช้ working links/readable screenshots และ final main เป็น source of truth หาก source เปลี่ยนหลัง verification ให้ rerun affected checks

Acceptance/evidence: FR-25, AC-31/32, RELEASE-01 และ Product DoD ทุกข้อ ไม่มี deployment/cloud scope เพิ่ม ผู้ใช้เป็นคน push เองจนกว่าจะสั่งเปลี่ยน

Dependencies: [#66](https://github.com/Chxtamos/-TokTickIT-/issues/66) และ actual contract/feature/release reviews

## Checklist ก่อนสร้าง Issues บน GitHub

- Copy Title/Description ของ 01-17 แล้วใส่เลขจริง/ลิงก์/dependencies ในเอกสารหลังสร้าง
- เพิ่มลง Project เดิมและตรวจชื่อ Kanban statuses จริง; ไม่ mark Done เพียงเพราะมี commit
- หลังผู้ใช้ push ให้สร้าง contract PR เข้า lab3-staging และเชื่อม Issue จริง ให้ peer review ก่อน main implementation completion
- ใช้เลข GitHub Issue จริง #51-#67 ใน PR/Project; สำหรับ staging PR เชื่อม Development relationship แบบ manual และตรวจ merge/review evidence ก่อนปิด Issue อย่าพึ่ง `Closes #...` เป็นหลักฐาน auto-close บน default branch
