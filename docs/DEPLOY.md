# เอาเกมขึ้นเซิร์ฟเวอร์จริง

เกมทั้งเกมคือ **process เดียว** — เสิร์ฟไฟล์ไคลเอนต์และรับ WebSocket บนพอร์ต
เดียวกัน ไม่มีขั้นตอน build ไม่มี bundler และมี dependency ตัวเดียวคือ `ws`
ข้อมูลโลกเก็บใน SQLite ไฟล์เดียว

---

## ความจุ

วัดเองได้ ไม่ต้องเดา:

```
npm run load              # 150 ไคลเอนต์ 30 วินาที
npm run load -- 300 60    # หนักกว่านั้น
npm run soak -- 20 30     # 20 บอท 30 นาที ดู heap / entity / การเซฟ
```

ตัวเลขจากเครื่องพัฒนา (150 ไคลเอนต์ยืนในเมืองเดียวกันหมด ซึ่งเป็นกรณีแย่สุด):
**9.3 สแนปช็อต/วินาที · ช่องว่างยาวสุด 204 ms · 139.8 KB/วินาที/คน**

**แบนด์วิดท์คือเพดานจริงของเซิร์ฟเวอร์นี้ ไม่ใช่ CPU** — 150 คนในเมืองเดียวกินราว
20 MB/วินาที ขาออก ถ้าจะรับคนมากกว่านี้ ให้ดูที่สายเน็ตก่อนดูที่ซีพียู หรือกระจาย
คนออกไปหลายโซน (ระบบ AOI ส่งเฉพาะสิ่งที่มองเห็น คนที่อยู่คนละมุมแผนที่แทบไม่มีค่าใช้จ่าย)

`/admin/stats.json` รายงาน `heapUsed` `rss` และ `entities` ไว้เฝ้าจากภายนอกได้

## 1. วิธีที่สั้นที่สุด: Docker Compose

```bash
docker compose up -d --build
# เปิด http://localhost:8080
```

`docker-compose.yml` ผูก volume ชื่อ `emberfall-data` ไว้ที่ `/data`
ซึ่งเป็นที่อยู่ของบัญชี ตัวละคร และตลาด — **อย่าลบ volume นี้**

อัปเดตเวอร์ชันใหม่:

```bash
git pull && docker compose up -d --build     # ข้อมูลใน volume อยู่ครบ
```

## 2. ไม่ใช้ Docker

```bash
npm ci --omit=dev
EMBERFALL_DATA=/var/lib/emberfall PORT=8080 npm start
```

ต้องใช้ **Node 22 ขึ้นไป** เพราะใช้ `node:sqlite` ที่ติดมากับ Node เอง
(ถ้ารันบน Node ที่ไม่มี ระบบจะเตือนแล้วถอยไปใช้ไฟล์ JSON ให้อัตโนมัติ)

ตัวอย่าง systemd unit:

```ini
[Unit]
Description=Emberfall Online
After=network.target

[Service]
ExecStart=/usr/bin/node /srv/emberfall/server/index.js
Environment=PORT=8080 EMBERFALL_DATA=/var/lib/emberfall EMBERFALL_STORE=sqlite
WorkingDirectory=/srv/emberfall
User=emberfall
Restart=always
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
```

`KillSignal=SIGINT` สำคัญ — เซิร์ฟเวอร์จะบันทึกโลกให้ครบก่อนปิดตัว

## 3. ตัวแปรสภาพแวดล้อม

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `PORT` | `8080` | พอร์ตของทั้ง HTTP และ WebSocket |
| `HOST` | `0.0.0.0` | อินเทอร์เฟซที่ผูก |
| `EMBERFALL_DATA` | `./data` | โฟลเดอร์เก็บโลก |
| `EMBERFALL_STORE` | `sqlite` | `sqlite` หรือ `json` |
| `EMBERFALL_DEV` | ไม่ตั้ง | ตั้งเป็น `1` เพื่อเปิดคำสั่งทดสอบ (วาร์ปข้ามโซน/ปลุกพลัง) — **ห้ามเปิดบนเซิร์ฟเวอร์จริง** |

## 4. Reverse proxy + HTTPS

ไคลเอนต์เลือก `ws://` หรือ `wss://` ตามโปรโตคอลของหน้าเว็บเอง แค่ต้องให้
proxy ส่ง `Upgrade` ผ่านไปได้

Caddy (ได้ใบรับรองให้อัตโนมัติ):

```
emberfall.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 600s;       # กันการตัดการเชื่อมต่อตอนยืนเฉยๆ
}
```

## 5. สำรองข้อมูล

```bash
EMBERFALL_DATA=/var/lib/emberfall node tools/backup.js /backup/emberfall
```

ใช้กลไก online backup ของ SQLite เอง จึงรันตอนเซิร์ฟเวอร์เปิดอยู่ได้
ไฟล์ที่ได้เป็นสำเนาที่สมบูรณ์ ไม่ใช่ครึ่งๆ กลางๆ (ถ้าจะก๊อปด้วยมือ ต้องเอา
`world.sqlite-wal` กับ `-shm` ไปด้วย)

ตั้ง cron รายวัน:

```cron
0 4 * * * cd /srv/emberfall && EMBERFALL_DATA=/var/lib/emberfall node tools/backup.js /backup/emberfall
```

## 6. ย้ายจากไฟล์ JSON เดิม

ถ้าเคยรันเวอร์ชันก่อนหน้าแล้วมี `world.json` อยู่ ครั้งแรกที่บูตด้วย
SQLite ระบบจะย้ายข้อมูลให้เองครั้งเดียว (`[db] migrated N characters…`)
ไฟล์เดิมไม่ถูกลบ เก็บไว้เป็นสำเนาได้เลย

## 7. ต้องใช้เครื่องแรงแค่ไหน

* โลกทั้งหมดอยู่ในหน่วยความจำ ทุกโซนเดินเป็น tick 20 ครั้ง/วินาที
  ส่ง snapshot 10 ครั้ง/วินาทีเฉพาะสิ่งที่อยู่ในระยะสายตาของผู้เล่นแต่ละคน
* โซนที่ไม่มีผู้เล่นจะข้าม AI ไปเลย เหลือแค่เกิดมอนสเตอร์และหมดอายุของดรอป
* เครื่อง 1 vCPU / RAM 512MB รับผู้เล่นพร้อมกันหลักสิบได้สบาย
  คอขวดคือ CPU ของ process เดียว ไม่ใช่ RAM
* เกมบันทึกโลกอัตโนมัติทุก 15 วินาที และบันทึกอีกครั้งตอนปิด
