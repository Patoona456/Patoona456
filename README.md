# Emberfall Online

เกม **2D MMORPG** เล่นผ่านเบราว์เซอร์ (และมือถือในอนาคต) แนวเดียวกับ Ragnarok
แต่เป็นโลก ระบบ และตัวเลขของเราเอง — **บังคับด้วยจอยเกมเป็นหลัก** รองรับทัชสกรีนและคีย์บอร์ดด้วย

งานศิลป์ทั้งหมดดึงจาก [Universal LPC Spritesheet](https://github.com/makrohn/Universal-LPC-spritesheet)
(ดูเครดิตและสัญญาอนุญาตที่ `assets/lpc/CREDITS.md`)

```
npm install
npm start           # http://localhost:8080
```

ต้องการดึงงานศิลป์ใหม่จากต้นทาง:

```
git clone --depth 1 https://github.com/makrohn/Universal-LPC-spritesheet.git
npm run import-lpc -- ./Universal-LPC-spritesheet
```

## ปรัชญาการออกแบบ

| หัวข้อ | ทางเลือกของเรา |
|---|---|
| การเล่น | เหมือน MMORPG คลาสสิก: ตี-เก็บเลเวล-แบ่งแต้ม-ตีบวก-ตั้งปาร์ตี้-ซื้อขาย |
| หน้าตา | ไม่ลอก Ragnarok — ชื่อ อาชีพ มอนสเตอร์ แผนที่ ทั้งหมดเป็นของเราเอง |
| เศรษฐกิจ | **เงินหายากโดยตั้งใจ** ของถึงมีค่า (ดู `docs/ECONOMY.md`) |
| การบังคับ | ออกแบบจากจอยก่อน แล้วแมปลงทัช/คีย์บอร์ด (ดู `docs/CONTROLS.md`) |
| เซิร์ฟเวอร์ | authoritative ทั้งหมด ไคลเอนต์ทำแค่ทำนายการเดินของตัวเอง |

## โครงสร้าง

```
shared/          โค้ดและฐานข้อมูลที่ทั้งสองฝั่งใช้ร่วมกัน
  constants.js   ค่าคงที่ + opcode ของโปรโตคอล
  formulas.js    สูตรสเตตัส/ดาเมจ/ราคา (pure functions)
  data/          jobs, skills, items, monsters, maps, npcs, quests
server/
  index.js       static server + websocket
  net.js         โปรโตคอลต่อหนึ่งการเชื่อมต่อ
  accounts.js    สมัคร/ล็อกอิน/สร้างตัวละคร (scrypt)
  persistence.js เก็บสถานะลง JSON แบบ atomic
  game/          world, zone, player, monster, combat, skills, economy, party, quests
client/
  index.html     โครง HUD ทั้งหมด
  js/            main, net, input (จอย/ทัช/คีย์), renderer, sprites, ui
assets/lpc/      สไปรต์ LPC ที่คัดมา 118 แผ่น + ไฟล์สัญญาอนุญาต
tools/           สคริปต์ดึงงานศิลป์จากต้นทาง
docs/            เอกสารออกแบบเกม เศรษฐกิจ ปุ่มควบคุม และแผนพัฒนา
```

## สถานะตอนนี้

เล่นได้จริงตั้งแต่ต้นจนจบลูป: สมัคร → สร้างตัวละคร → เดิน → ตี → เก็บของ →
เลเวลอัพ → แบ่งแต้ม → เรียนสกิล → เปลี่ยนอาชีพ → ซื้อขาย/ตีบวก/ฝากของ →
ลงตลาดผู้เล่น → ตั้งปาร์ตี้ → ทำเควสต์ → ล่าบอส

ดูงานที่เหลือและลำดับความสำคัญได้ที่ `docs/ROADMAP.md`

## ใบอนุญาต

โค้ด: GPL-3.0-or-later (ให้เข้ากับงานศิลป์ LPC ที่เป็น CC-BY-SA 3.0 / GPL 3.0)
