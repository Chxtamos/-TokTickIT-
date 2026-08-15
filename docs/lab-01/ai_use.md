# Lab 1 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex (GPT-5.6 Sol, High reasoning)

## Selected Key Prompts

| # | Selected Prompt | What I Did with the Result |
|---|---|---|
| 1 | "อ่านรายละเอียดเนื้อหาการทำ Lab ในชีทนี้ทั้งหมดแบบละเอียด แล้วลำดับการทำอย่างละเอียดว่าควรทำอะไรก่อนหลัง ห้ามข้ามขั้น และอย่าเพิ่งลงมือทำ" | ใช้คำตอบเพื่อทำความเข้าใจ Structure ของ Repository, GitHub workflow, Issues ทั้ง 4 เพื่อความเข้าใจเเละเป็นการวางเเผนก่อนลงมือทำ|
| 2 | "ตอนนี้ฉันสร้าง Branch `feature/1-project-foundation` ไปแล้ว แต่ยังไม่ได้ push ต้องทำระยะที่ 3 ไหม" | ตรวจลำดับ Workflow ของ Issue #1 และเรียนรู้ว่าต้องทำงานบน feature branch ก่อน push และเปิด Pull Request เข้า `lab1-staging` ป้องกันการ push ผิด Branch |
| 3 | "`npx prisma generate` แจ้งว่าไม่มี model และ `prisma migrate status` ได้ P1010 ต้องแก้อย่างไร" | ตรวจการตั้งค่า PostgreSQL, Prisma, Database user และ `DATABASE_URL` โดยไม่ commit `.env` หรือข้อมูลลับ ขึ้นไปบน Git |
| 4 | "อัปเดต README ยังไง" | อยากจะเพิ่ม Technology stack, Project structure, Installation, Environment setup, Database setup, Prisma commands, Running application และ Running tests สำหรับ Issue #1 ขึ้นไปบน Git จากของเก่า|
| 5 | "ฉัน push Feature 1 แล้ว ต่อไปคือเอา Issue #2 ไว้ Specified แล้วสร้าง branch ใช่ไหม ตรวจสอบตาม PDF" | ตรวจ Dependency และเริ่ม Issue #2 บน `feature/2-health-check` โดยไม่พัฒนาโดยตรงบน `main` หรือ `lab1-staging` เเละยังให้ AI Recheck ว่าถูกต้องตาม Labsheet กำหนด|
| 6 | "ผล `npm test` ของ Server ล้มเหลว เพราะ Health test คาดหวัง HTTP 200 แต่ได้รับ 501 ต้องแก้อย่างไร" | แก้ `GET /api/health` ให้คืน HTTP 200 และ JSON ที่ตรงกับ Acceptance criteria จากนั้นรัน Supertest ใหม่จนผ่าน โดยส่วนนี้จะเเก้ปัญหาที่เกิดขึ้นใน Issue 2|
| 7 | "`npx prisma migrate dev --name init` ได้ P3014: permission denied to create database" | ตรวจสิทธิ์ PostgreSQL role สำหรับ Shadow database แล้วรัน Migration ใหม่จน Database และ Prisma schema อยู่ในสถานะ Sync |
| 8 | "Seed รันสองครั้งแล้ว หลังจากนี้ถ้าต้องแคปอะไรต้องบอกฉันด้วย" | ตรวจว่า Seed ใช้ `upsert` และใช้ SQL ยืนยันว่ามี 4 rows กับ 4 unique names โดยไม่มีข้อมูลซ้ำตาม Acceptance criteria ของ Issue #3 ไหม|
| 9 | "Branch ล่าสุดเป็น `feature/4-category-list` เรียบร้อยแล้ว ต่อไปได้เลย" | ตรวจไฟล์เดิมก่อนเพิ่ม `GET /api/categories`, Prisma query, React category list, Loading/Online/Offline states, Supertest และ Vitest สำหรับ Issue #4 |
| 10 | "Categories test ผ่าน แต่ Health test ล้มเหลว เพราะคาดหวัง 200 แต่ได้รับ 404" | ไม่ยอมรับผลลัพธ์ที่ผ่านเพียงบาง Test และตรวจ `server/src/app.ts` ใหม่ ก่อนคืน Health route แล้วรัน Backend tests จนผ่านทั้ง 2 Tests |



## Reflection

ช่วงแรกผมใช้ Prompt ให้ AI ช่วยอธิบาย Structure และลำดับการทำ Lab เพื่อให้ผมเข้าใจเนื้อหาใน Lab sheet ก่อนเริ่มลงมือทำ แต่ยังต้องถามต่อหลายครั้งเพื่อให้เข้าใจรายละเอียดของแต่ละ Issue มากขึ้น หลังจากนั้นผมจึงปรับวิธีเขียน Prompt โดยระบุ Branch คำสั่งที่ใช้ และ Error ที่พบ ทำให้ AI แนะนำวิธีแก้ปัญหาได้ตรงจุดมากขึ้น ตัวอย่างเช่น คำสั่ง `psql -c` ที่ไม่สามารถใช้งานได้ตามที่คาดไว้บน PowerShell ผมจึงส่ง Error กลับไปให้ AI ตรวจสอบและปรับเป็นการส่ง SQL ผ่าน Pipeline จนสามารถตรวจข้อมูลได้สำเร็จ จากการทำ Lab ครั้งนี้ ผมได้เรียนรู้ว่าไม่ควรเชื่อคำตอบของ AI ทันที แต่ควรตรวจสอบกับ Lab sheet ผลลัพธ์จาก Terminal และ Automated tests รวมถึงให้ AI ทบทวนคำตอบโดยอ้างอิงจาก Labsheet เป็นหลักพบความผิดปกติของคำตอบ

