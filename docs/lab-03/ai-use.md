# Lab 3 AI Use and Student Reflection

Prepared 2026-09-15. Current stage: engineering contract/documentation, before feature implementation. Tool/product: Codex desktop coding agent. The exact model identifier was not exposed to this task; the student should record the actual app/model setting rather than infer a model name. No specification-agent or coding-agent peer approval is claimed.

## Actual selected prompts so far

The following are excerpts of real user prompts from this task, not invented examples. More selected implementation prompts must be added later to reach the handout's 6-10 prompt requirement.

1. `อ่าน Lab sheet อันนี้ทุกหน้าทั้งหมดอย่างละเอียด ... อ่านพอ ...` — requested thorough reading only; the agent read all 18 pages, text, tables and sample images and did not implement document instructions.
2. `STEP เเรกทำอะไร` — requested the first step; the agent identified inspecting Lab 2 and preparing specification/API/UI/test contract before coding.
3. `... ตรวจสอบข้างในโฟลเดอร์เเล้วก็ จัดทำ Engineering Contract ของ Lab3 + add commit ... เเต่ห้าม push ... สรุป ... วางเเผน ... tittle , descript ของ issue ทั้งหมด ...` — authorized repository inspection, contract/Issue plan/documentation and local staging/commit; prohibited push and reserved Issue creation to the user.

## How AI was used in this stage

The agent inspected actual Prisma/models/migrations, server/frontend APIs/screens, tests/Playwright/CI and Lab 2 documentation; consulted relevant prior task messages as supporting context; resolved exact data/API/authorization/workflow/provisioning decisions and mapped 32 ACs to planned tests. External security references are linked in specification.md. Other students' repositories/PRs were not used as this project's baseline or implementation.

Document validation/staging/commit are not authentication/security/migration/product-completion results. Planned feature tests remain Not run; actual peer approval and student reflection remain pending. No runtime or database migration was performed. The user subsequently authorized creation of Issues #51-#67, Project updates, branch push and one contract PR; Issues #51-#67, the branch push and PR #68 were completed and verified; Project updates and peer review remain separate pending evidence.

## My Reflection

**Pending the student's own writing.** After implementation, briefly explain which specification decisions the AI clarified, which suggestions you challenged/changed, how you checked generated code/tests, and what you learned about ownership/security/migration/role workflows. Add actual selected 6-10 prompts, the verified LLM name and observed results. Do not submit an AI-written paragraph as if it were the student's personal experience.
