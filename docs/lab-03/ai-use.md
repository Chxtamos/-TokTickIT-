# Lab 3 AI Use and Student Reflection

Prepared 2026-09-15. Current stage: engineering contract/documentation, before feature implementation. Tool/product: Codex desktop coding agent. The exact model identifier was not exposed to this task; the student should record the actual app/model setting rather than infer a model name. No specification-agent or coding-agent peer approval is claimed.

## Actual selected prompts so far

The following are excerpts of real user prompts from this task, not invented examples. More selected implementation prompts must be added later to reach the handout's 6-10 prompt requirement.

1. `อ่าน Lab sheet อันนี้ทุกหน้าทั้งหมดอย่างละเอียด ... อ่านพอ ...` — requested thorough reading only; the agent read all 18 pages, text, tables and sample images and did not implement document instructions.
2. `STEP เเรกทำอะไร` — requested the first step; the agent identified inspecting Lab 2 and preparing specification/API/UI/test contract before coding.
3. `... ตรวจสอบข้างในโฟลเดอร์เเล้วก็ จัดทำ Engineering Contract ของ Lab3 + add commit ... เเต่ห้าม push ... สรุป ... วางเเผน ... tittle , descript ของ issue ทั้งหมด ...` — authorized repository inspection, contract/Issue plan/documentation and local staging/commit; prohibited push and reserved Issue creation to the user.
4. `เปิด issue ... ทั้งหมด 17 อัน ใส่ title เเละ descript + add มันเข้า project ... push feature/24-lab3-engineering-contract ... เปิด PR` — authorized the real Issue/Project/branch/PR workflow after the earlier no-push boundary was explicitly changed.
5. `แก้ไขตาม feedback PR #68` — directed the agent to reconcile logout semantics, staging linkage, terminal ownership, scope, scrypt benchmarking, release evidence and exact paths across the contract.
6. `ฉัน push ขึ้นผิดอัน ... ตรวจสอบ Repo ที่ฉันส่งให้แล้วตรวจสอบสิ่งที่ฉันแก้ แล้ว push` — directed recovery of the developer-written reviewer identity and Reflection from the wrong repository and transfer to this PR only.
7. `Initial-password session expiry ยัง ambiguous ... Password-change + session rotation ... atomic ... ตัด manual unassign` — required fixed restricted-session boundaries, atomic credential/session rotation and a deliberate scope decision before implementation.
8. `Issue #62 ... ยังมี Unassign; Issue #61 ... ยังมี unique-key/replay wording` — required the implementation handoff and live Issues to match the already revised normative contract.

## How AI was used in this stage

The agent inspected actual Prisma/models/migrations, server/frontend APIs/screens, tests/Playwright/CI and Lab 2 documentation; consulted relevant prior task messages as supporting context; resolved exact data/API/authorization/workflow/provisioning decisions and mapped 32 ACs to planned tests. External security references are linked in specification.md. Other students' repositories/PRs were not used as this project's baseline or implementation; the L0u1sss repository was read only to recover the two developer-authored documentation edits that had been pushed there by mistake.

Document validation/staging/commit are not authentication/security/migration/product-completion results. Every Lab 3 test in `tests.md` remains `Planned / Not run`; there is no implementation evidence yet. The developer Reflection is now recorded below, while peer re-review/approval remains pending. No runtime or database migration was performed. The user subsequently authorized creation of Issues #51-#67, Project updates, branch push and one contract PR; those remote actions were completed and verified.

## My Reflection

ใน Lab 3 ผมใช้ AI Agent ช่วยอ่าน labsheet สรุป requirements และจัดทำ specification, API, UI และ test plan ทำให้เห็นภาพรวมของระบบได้ชัดขึ้นและตรวจสอบว่าเอกสารตรงกับสิ่งที่ต้องการหรือไม่

อย่างไรก็ตาม คำตอบจาก AI ยังต้องผ่านการตรวจสอบแบบ Human-in-the-loop เพราะในช่วงแรกมีข้อกำหนดบางจุดไม่ตรงกัน ปัญหาเหล่านี้ถูกพบและแก้ไขผ่าน peer review โดยตรวจเทียบกับข้อกำหนดใน Lab 3 labsheet อีกครั้ง
