# Lab 1 — Peer Review Record

**Author:** Chartanat upthaipiboon — GitHub: @Chxtamos
**Peer reviewer1:** Phalat Amachayapha —  GitHub: @L0u1ss
**Peer reviewer2:** Tanboon Teawsawat  — GitHub: @Tanaboonnnnn

## Pull Requests I Authored

| Pull Request | Branch | Reviewer | Verdict |
|---|---|---|---|
| [PR #5](https://github.com/Chxtamos/-TokTickIT-/pull/5) | `feature/1-project-foundation` | @L0u1sss | Approved |
| [PR #6](https://github.com/Chxtamos/-TokTickIT-/pull/6) | `feature/2-health-check` | @Tanaboonnnnn | Approved |
| [PR #7](https://github.com/Chxtamos/-TokTickIT-/pull/7) | `feature/3-category-seed` | @Tanaboonnnnn | Approved |
| [PR #8](https://github.com/Chxtamos/-TokTickIT-/pull/8) | `feature/4-category-list` | @Tanaboonnnnn | Approved |

## Review Comments I Received

### Issue #1

**Reviewer comment:**
[ลง package ครบ
run test ผ่าน
ไม่มีไฟล์ที่เป็นsecrets โผล่มา
README ตรงตามงาน]

**My response:**
[thx for comment]


### Issue #2

**Reviewer comment:**
[Approve ครับโบร๋

GET /api/health คืน HTTP 200 ถูกต้อง
response มี status = ok และ service = TokTickIT API
React เรียก health API จริง
มี Online และ Offline state
มี useful error message เมื่อ backend unavailable
Supertest health check ระบุว่าผ่าน
มีแค่ style เล็กน้อย เช่น TODO comment ที่ยังเหลืออยู่ แต่ไม่กระทบ acceptance criteria]

**My response:**
[thx for comment]


### Issue #3

**Reviewer comment:**
[ตรวจ Issue 3 แล้วโบร๋

Category model มี id, unique name และ createdAt ครบ
มี migration สร้าง Category table และ unique index
seed มี 4 categories ครบ
ใช้ upsert ทำให้รันซ้ำได้โดยไม่เกิด duplicate
verification ระบุว่า seed รันซ้ำ 2 รอบแล้ว DB ยังมี 4 unique rows
ไม่พบ database credentials ถูก commit]

**My response:**
[thx for comment]


### Issue #4

**Reviewer comment:**

[GET /api/categories ดึงข้อมูลจาก PostgreSQL ผ่าน Prisma
API คืน id และ name ของแต่ละ category ตามลำดับที่คาดเดาได้
มี Supertest ทดสอบ category API
React แสดง categories ที่ได้จาก API จริง ไม่ได้ hard-code ใน UI
มี loading และ error states
มี Vitest ทดสอบพฤติกรรมของ category list UI
ครับต้าวเมิส]

**My response:**
[thx for comment]


## Pull Requests I Reviewed for My Partner

| Partner Pull Request | My Verdict |
|---|---|
| [L0u1sss/TokTickIT PR #5](https://github.com/L0u1sss/TokTickIT/pull/5) | Approved |



## My Review Comments and Partner Responses

### Partner Pull Request 1

**My review comment:**

[README เขียน Structure ผิด
Prisma เเละ backend test ต้องอยู่ใต้ Server เเต่ใน README อยู่ใน root
ตามโครงสร้างนี้
toktickit/
├── client/
│ ├── src/
│ └── tests/
├── server/
│ ├── prisma/
│ ├── src/
│ └── tests/
│ └── lab-01/
├── docs/
│ └── lab-01/
│ ├── ai_use.md
│ ├── reviewer.md
│ └── tests.md
├── .gitignore
└── README.md

คำสั่ง Clone ไม่ควรมี < > และควรเข้าโฟลเดอร์ตามชื่อ repo

ในไฟล์ server/prisma/schema.prisma มี model Catagory ซึ้งไม่เป็นไปตาม Acceptance Criteria]

**Partner response:**
[-]
