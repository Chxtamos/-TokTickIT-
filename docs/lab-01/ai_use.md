# Lab 1 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex (GPT-5.6 Sol, High reasoning)

## Selected Key Prompts

| # | Selected Prompt | What I Did with the Result |
|---|---|---|
| 1 | "อ่านรายละเอียดเนื้อหาการทำ Lab ในชีทนี้ทั้งหมดเเบบละเอียดเเล้ว ลำดับการทำอย่างละเอียดว่าควรทำอะไรก่อนหลังห้ามข้ามขั้น เด็ดขาดอย่าพึ่งลงมือทำ" | ต้องการรู้ Structure เเละขอบเขตของงานให้ละเอียด |
| 2 | "ทำไมเลือกสร้าง Issue ก่อน Issue มันคืออะไร นายอ่าน PDF Lab sheet ในโปรเจกต์นี้" | ทำความเข้าใจเนื้อหาที่ลึกขึ้น ว่า Issue มันใช้กำหนดขอบเขตงานและ Acceptance criteria ก่อนสร้าง branch และเริ่ม implementation ยังไง|
| 3 | "ตอนนี้ฉันสร้าง Branch feature/1-project-foundation ไปแล้ว แต่ยังไม่ได้ push ต้องทำระยะที่ 3 ไหม" | ตรวจลำดับ Workflow ของ Issue #1 และ push branch โดยไม่ยุ่งโดยตรงบน main หรือ lab1-staging |
| 4 | "npx prisma generate แจ้งว่าไม่มี model และ prisma migrate status ได้ P1010 ต้องแก้อย่างไร" | ตรวจการตั้งค่า PostgreSQL, Prisma และ DATABASE_URL โดยไม่ commit ข้อมูลลับ เเละตรวจสอบด้วยว่าทำ database ถึงใช้งานไม่ได้|
| 5 | "อัปเดต README ยังไง" | เพิ่ม Technology stack, Project structure, Installation, Environment configuration, Running application และ Running tests |
| 6 | "ใช้การ PR ก่อน push ขึ้น lab1-staging ไหม" | เรียนรู้ว่าต้อง push feature branch ก่อน แล้วเปิด Pull Request โดยกำหนด base เป็น lab1-staging |
| 7 | "ฉัน push feature 1 แล้ว ต่อไปคือเอา Issue 2 ไว้ Specified แล้วสร้าง branch ใช่ไหม ตรวจสอบตาม PDF" | ทำ Issue #2 บน feature/2-health-check เพิ่ม Health API, React status display และ Supertest |
| 8 | "npx prisma migrate dev --name init ได้ P3014: permission denied to create database" | ตรวจpสิทธิ์ PostgreSQL shadow database แก้สิทธิ์ role แล้วสร้างและ apply migration สำเร็จ |
| 9 | "Seed รันสองครั้งแล้ว หลังจากนี้ถ้าต้องแคปอะไรต้องบอกฉันด้วย" | ตรวจว่า Seed ใช้ upsert และยืนยันว่ามี 4 rows กับ 4 unique names โดยไม่มีข้อมูลซ้ำ |
| 10 | "Branch ล่าสุดเป็น feature/4-category-list เรียบร้อย" | ทำ GET /api/categories ผ่าน Prisma, แสดง Category list ใน React, เพิ่ม Online/Offline states และทำ Supertest กับ Vitest ให้ผ่าน |

## Reflection

ในช่วงเเรกของการ Promt ผมจะเน้นไปทางเข้าใจเนื้อหางานทั้งหมดให้ดีก่อน เพราะถ้าผิดพลาดตั้งเเต่เริ่มต้นในส่วนอื่นๆก็จะผิดพลาดตามไปด้วย ผมจึงให้มันเเจกเเจงเนื้อหา Struture เเล้วค่อยๆเจาะลึกลงไปที่ระยะ ถ้าส่วนไหนที่ไม่เข้าใจก็จะถามมัน ex อยากรู้ว่า issue คืออะไร หลังจากที่สงสัยเเล้วก็จะเริ่มทำที่ละขั้นตอนเเบบละเอียดตามที่ Ai บอกระหว่างทำก็จะเอะไปด้วยว่าสิ่งที่มันบอกมาถูกต้องไหมถ้าไม่ถูกก็จะให้มันกลับไปทบทวนในส่วนของ pdf Lab sheet ที่ส่งให้มันอ่าน ระหว่างทำใน Issue ต่างๆก็จะมีถามมันเวลาติดขัดอะไรไปด้วย ใน โฟลเดอร์ โปรเจค ก็จะเน้นไปทางถามมากกว่า เพราะว่า ผมเรียงเเละวางเเผนขั้นตอนออกมาได้ดีตั้งเเต่ต้น