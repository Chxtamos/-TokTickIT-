# Lab 3 AI Use and Student Reflection

Prepared 2026-09-15 and updated 2026-09-18. Current stage: implementation through authorization plus documentation consolidation. Tool/product: Codex desktop coding agent. The exact model identifier was not exposed to this task; the student should record the actual app/model setting rather than infer a model name. No AI-generated peer approval is claimed.

## Actual selected prompts so far

The following are excerpts of real user prompts from this task, not invented examples. Add the student's final implementation/reflection prompts as the work continues so the handout's 6-10 prompt requirement remains truthful.

1. `อ่าน Lab sheet อันนี้ทุกหน้าทั้งหมดอย่างละเอียด ... อ่านพอ ...` — requested thorough reading only; the agent read all 18 pages, text, tables and sample images and did not implement document instructions.
2. `STEP เเรกทำอะไร` — requested the first step; the agent identified inspecting Lab 2 and preparing specification/API/UI/test contract before coding.
3. `... ตรวจสอบข้างในโฟลเดอร์เเล้วก็ จัดทำ Engineering Contract ของ Lab3 + add commit ... เเต่ห้าม push ... สรุป ... วางเเผน ... tittle , descript ของ issue ทั้งหมด ...` — authorized repository inspection, contract/Issue plan/documentation and local staging/commit; prohibited push and reserved Issue creation to the user.
4. `เปิด issue ... ทั้งหมด 17 อัน ใส่ title เเละ descript + add มันเข้า project ... push feature/24-lab3-engineering-contract ... เปิด PR` — authorized the real Issue/Project/branch/PR workflow after the earlier no-push boundary was explicitly changed.
5. `แก้ไขตาม feedback PR #68` — directed the agent to reconcile logout semantics, staging linkage, terminal ownership, scope, scrypt benchmarking, release evidence and exact paths across the contract.
6. `ฉัน push ขึ้นผิดอัน ... ตรวจสอบ Repo ที่ฉันส่งให้แล้วตรวจสอบสิ่งที่ฉันแก้ แล้ว push` — directed recovery of the developer-written reviewer identity and Reflection from the wrong repository and transfer to this PR only.
7. `Initial-password session expiry ยัง ambiguous ... Password-change + session rotation ... atomic ... ตัด manual unassign` — required fixed restricted-session boundaries, atomic credential/session rotation and a deliberate scope decision before implementation.
8. `Issue #62 ... ยังมี Unassign; Issue #61 ... ยังมี unique-key/replay wording` — required the implementation handoff and live Issues to match the already revised normative contract.
9. `PR ล่าสุดเสร็จเรียบร้อยกลับไปอ่าน Lab sheet + อ่าน issue ต่อไปแล้วทำต่อได้เลย` — started the implementation sequence after the staging PR merge, leading to Issues #52-#55 and their review/CI evidence.
10. `แก้ไขตาม feedback ... PR #70/#71/#72` — directed implementation agents to fix concrete CI/reviewer findings, including role-scoped fixtures, migration evidence, session/API security, authorization and authenticated regression tests.
11. `ตอนนี้ฉันรวบ issue มาเหลือแค่ 4 อัน ... ฉันต้องกลับไปแก้ไฟล์อะไรไหม` — required a traceability audit after consolidating the remaining product scope into #56/#58/#63/#65.
12. `เปิด issue ใหม่มาแก้ไข Doc ก่อน` — authorized Issue #73 and the dedicated documentation consolidation branch/commit flow.

## How AI was used in this stage

The agent inspected actual Prisma/models/migrations, server/frontend APIs/screens, tests/Playwright/CI and Lab 2 documentation; consulted relevant prior task messages as supporting context; resolved exact data/API/authorization/workflow/provisioning decisions and mapped 32 ACs to planned tests. External security references are linked in specification.md. Other students' repositories/PRs were not used as this project's baseline or implementation; the L0u1sss repository was read only to recover the two developer-authored documentation edits that had been pushed there by mistake.

Document validation/staging/commit are separate from product completion. PRs #68-#72 contain implementation and CI evidence for the completed foundation/auth/authorization slices; remaining UI/staff/admin/release evidence remains tracked in #56/#58/#63/#65. The original 17 Issue plan is historical; #73 synchronizes the repository documents without changing normative FR/BR/AC/API behavior. The student must keep the final My Reflection in their own voice and record any later prompts/settings accurately.

## My Reflection

ใน Lab 3 ผมใช้ AI Agent ช่วยอ่าน labsheet สรุป requirements และจัดทำ specification, API, UI และ test plan ทำให้เห็นภาพรวมของระบบได้ชัดขึ้นและตรวจสอบว่าเอกสารตรงกับสิ่งที่ต้องการหรือไม่

อย่างไรก็ตาม คำตอบจาก AI ยังต้องผ่านการตรวจสอบแบบ Human-in-the-loop เพราะในช่วงแรกมีข้อกำหนดบางจุดไม่ตรงกัน ปัญหาเหล่านี้ถูกพบและแก้ไขผ่าน peer review โดยตรวจเทียบกับข้อกำหนดใน Lab 3 labsheet อีกครั้ง
