# Lab 2 AI Use and Reflection

## AI Model and Agent Environment

- **AI product/agent:** OpenAI Codex through ChatGPT
- **Model:** `GPT 5.6 Sol (High)`
- **Primary roles used:** requirements analysis, Lab 1 repository inspection, Git/PR diagnosis, engineering-contract preparation, test planning, UI/API specification, and consistency review

## How AI Was Used

AI was used as a specification and engineering assistant. It was not authorized to approve the contract, fabricate peer review, invent evidence, commit, merge, or push the final documents without Human review. The student remains responsible for every requirement, business rule, acceptance criterion, design decision, test, code change, and submission claim.

## Selected Key Prompts Actually Used

| # | Selected prompt (summarized from the actual conversation) | How the result was used / Human action required |
| --- | --- | --- |
| 1 | “Lab 2 ช่วยอ่านเนื้อหาทั้งหมดแบบละเอียดพร้อมกับอธิบายฉันแบบละเอียด เป็น STEP แล้วก็สรุปเนื้อหาด้วยว่าโจทย์ต้องการอะไรบ้าง ห้ามข้ามห้ามตกหล่นเนื้อหาสาระสำคัญ จุดไหนที่ต้องใช้ Human จุดไหนที่ใช้ AI ได้ พวกข้อจำกัดต่างๆ เอามาให้ครบด้วย” | Used to identify the complete Lab 2 scope, fixed constraints, excluded features, required documents, Git workflow, test evidence, and Human responsibility before implementation. The student must verify the interpretation against the PDF. |
| 2 | “Lab อันนี้ต้องทำเป็นลำดับขั้นตอนห้ามข้าม นายย้อนกลับไปอ่านเนื้อหาใน Project นี้จะมีเนื้อหา Lab 1 ไว้ว่าฉันทำอะไรไปบ้าง เริ่ม STEP แรกได้เลย” | Used to inspect the existing Lab 1 foundation and to enforce the Engineering Contract gate before code. An incorrect workspace path was initially inspected; the student later provided the correct repository path. |
| 3 | “เอาใหม่ฉันยังไม่ได้บอกให้ทำ ตอนนี้ Main ล่าสุดอยู่ `C:\Users\mos28\Desktop\📁 โปรเจกต์\TokTickIT Full-Stack\Lab1\toktickit` นายตรวจสอบก่อนถูกไหม แล้วก็บอกฉัน Step แรกต้องทำอะไรก่อน” | Used to verify the real repository, clean `main`, Lab 1 commit history, technology stack, schema, APIs, tests, and documentation. The first required Lab 2 action was identified as the Engineering Contract Issue and branch workflow. |
| 4 | “งั้นเอาทุกสเต็ปแบบละเอียด ตรงไหนที่ใช้ AI Agent ไม่ได้ต้องใช้ Human นายแจ้งด้วย” | Used to create the ordered workflow, Human approval gates, feature dependencies, TDD sequence, PR review rules, integration checks, and final PDF evidence plan. |
| 5 | “ตอนนี้เปิด PR ไปแล้ว ฉันน่าจะทำผิด เข้าไปตรวจสอบให้ที `C:\Users\mos28\Desktop\📁 โปรเจกต์\TokTickIT Full-Stack\Lab1\toktickit` ตาม Path นี้ และ Pull request #13” | Used to inspect PR #13 read-only. The review found correct base/head branches and Issue linkage, but also found six empty Markdown files, a self-referencing `Related to #13`, inaccurate completed checkboxes, and a real Changes Requested review. |
| 6 | “นายตอบคำถามฉัน `.md` ทั้งหมด สามารถใช้ AI Agent เขียนได้ไหม หรือว่าต้องให้ Human เป็นคนทำ ตาม PDF ที่ส่งไป” | Used to confirm that AI is expected to help prepare `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md`, while Human must review, correct, decide, and approve. It also identified that `reviewer.md` must contain real evidence and that the reflection must be the student's own experience. |
| 7 | “งั้นนายเข้าไปเขียนให้หน่อย เดี๋ยวฉันจะเป็นคน approve เองก่อน push ขึ้น” | Used to prepare local versions of all six Lab 2 Markdown files on `feature/5-lab2-engineering-contract`. No commit or push occurred during that action; Human approval was required first. |

## Important AI Corrections and Rejections

1. The AI initially inspected and created files in an incorrect temporary repository path before the student supplied the correct repository path. Those files were not pushed to the student's GitHub repository.
2. The student corrected the working repository to `C:\Users\mos28\Desktop\📁 โปรเจกต์\TokTickIT Full-Stack\Lab1\toktickit`.
3. PR #13 was inspected rather than accepted at face value; the files were confirmed to be empty even though its verification checklist was marked complete.

## Human Decision Review

**Reviewed by the student on 2026-08-24:**

- The API contract and Business Rules were reviewed and approved as written.
- Decisions D-01 through D-13 in `specification.md` were approved as written.
- The Test Plan and UI Specification were reviewed and approved as written.

## My Reflection

Lab นี้ใช้ AI Agent ทำงานเป็นส่วนใหญ่ เช่นการวางเเผนการทำงานที่ทำซ้ำเยอะ โดยจะเน้นการ promt ที่ดีมากกว่า Lab 1 เช่นลงลึกเจาะบทบาทให้มันทำงานเฉพาะส่วนให้ดีมากขึ้นส่วนที่ปฏิเสธมันเด็ดขาดคือการให้มันอย่าทำงานเองโดยไม่ยังไม่ได้สั่ง

## Human Approval Checklist

- [x] The exact AI/model name is confirmed.
- [x] The 6-10 selected prompts represent prompts that were actually used.
- [x] The “How the result was used” descriptions are accurate.
- [x] Mistakes and rejected AI output are not hidden.
- [x] The reflection is written by the student in their own words.
- [x] No AI claim is treated as evidence without repository/test/PR verification.
