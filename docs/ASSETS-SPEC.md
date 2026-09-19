# สเปก asset ชุดใหม่ (2D MMORPG Pixel Art)

อ่านจากบอร์ดสเปกที่ได้รับ 13 แผ่น บันทึกไว้เพื่อให้ตอนไฟล์จริงมาถึงเสียบได้เลย
ไม่ต้องเดา **บอร์ดพวกนั้นเป็นภาพพรีวิว ไม่ใช่ตัว asset** — ตัวจริงยังต้องส่งมาแยก

## มาตรฐานกลาง (ทุกแผ่นตรงกัน)

| หัวข้อ | ค่า |
|---|---|
| ขนาดเฟรม | **128 × 128 px** (ย่อเหลือ 64×64 ได้) |
| ความสูงตัวละคร | ~96 px |
| จุดหมุน (pivot) | **ล่างกลาง** (bottom center) |
| ทิศ | **8 ทิศ** |
| ลำดับทิศ | Front(ล่าง) · Down-Left · Left · Up-Left · Back(บน) · Up-Right · Right · Down-Right |
| พื้นหลัง | โปร่งใส (PNG) |
| รูปแบบไฟล์ | PNG Sequence |

ลำดับทิศนี้บันทึกไว้ที่ `shared/facing.js` (`DIR8`) — เป็นลำดับเดียวกับคอลัมน์ในบอร์ด

## ท่าของตัวละคร (11 ท่า)

`Idle · Walk · Run · Attack1(ใกล้) · Attack2(ไกล) · Skill · Hurt · Die · Sit · Victory · Emote`

**ชื่อท่าไม่ตรงกับที่เอนจินใช้อยู่** เอนจินเรียก `slash / thrust / shoot / spellcast`
แก้โดยให้ layout ประกาศ alias ของตัวเอง ไม่ต้องไปแก้ชื่อในข้อมูลสกิลที่ตัวละครผู้เล่นผูกอยู่:

| เอนจินเรียก | ชีตใหม่เรียก |
|---|---|
| `slash` | `attack1` |
| `thrust` | `attack2` |
| `shoot` | `attack2` |
| `spellcast` | `skill` |

Emote มี 9 ไอคอน: ❤️ 🎵 💬 ❗ ❓ ✨ 💤 ✚ 💧

## ท่าของมอนสเตอร์ (5 ท่า)
`Idle · Walk · Attack · Hurt · Die` × 8 ทิศ

มอนในบอร์ด 30 ชนิด: Slime Poring Lunatic Mushroom Fabre Chonchon Wolf Boar Spider
Scorpion Snake Bee Plant Ghost Skeleton Zombie Orc Goblin Lizardman Harpy Golem Ogre
Treant Mimic · มินิบอส Devil Drake Beholder · บอส Dragon Dark Knight Lich Giant Demon Lord

## ลำดับชั้นสวมใส่

บอร์ดระบุ: `Base → Top → Bottom → Shoes → Gloves → Cloak → Weapon → Accessory`

**ไม่ตรงกับลำดับเดิมของเกม** (เดิมเอากางเกงไว้ใต้เสื้อ และไม่มีผ้าคลุม)
แก้แล้วโดยให้แต่ละ layout ถือลำดับของตัวเอง — `CHIBI_ORDER` ใน `client/js/sprites.js`

## ช่องสวมใส่: ของใหม่มีมากกว่าเกม

| บอร์ด | ช่องในเกม | สถานะ |
|---|---|---|
| Top | `torso` | มีแล้ว |
| Bottom | `legs` | มีแล้ว |
| Shoes | `feet` | มีแล้ว |
| Gloves | `hands` | มีแล้ว |
| Belt | `belt` | มีแล้ว |
| Hat / Helmet | `head` | มีแล้ว |
| Accessory | `accessory` | มีแล้ว |
| Weapon | `weapon` | มีแล้ว |
| Shield | `offhand` | มีแล้ว |
| Wing / Back | `wings` | มีแล้ว |
| **Armor** | — | **ยังไม่มี** (บอร์ดแยก Armor ออกจาก Top คือใส่ทับได้) |
| **Cloak / Cape** | — | **ยังไม่มี** (ช่องหลัง แยกจากปีก) |
| **Glasses** | — | **ยังไม่มี** |
| **Mask** | — | **ยังไม่มี** |
| **Scarf** | — | **ยังไม่มี** |

ห้าช่องล่างเป็นการเปลี่ยนโครงสร้างที่กระทบข้อมูลตัวละครที่บันทึกไว้แล้ว
`CHIBI_ORDER` เผื่อชื่อ `back` `face` `neck` ไว้ให้แล้ว แต่**ยังไม่ได้เปิดใช้**
รอตัดสินใจว่าจะเพิ่มจริงไหม

## อาวุธ (12 ชนิด × 3 แบบ)
Sword · Great Sword · Dagger · Axe · Spear · Bow · Staff · Wand · Knuckle · Shield · Throwing · Special

ตอนนี้เกมมีครบสิบสองชนิดแล้วที่ `shared/weapons.js` ชนิดหนึ่งบอกสามอย่างพร้อมกัน:
ถือได้กี่มือ (`hands`) ฟันด้วยท่าไหน (`anim`) และเป็นอาวุธเวทหรือไม่ (`magic`)

* `blade` เดิมแยกเป็น **sword** กับ **dagger** — ของเดิมทั้งห้าเล่มเป็นมีดสั้น
  (สไปรต์ก็เป็น `dagger` หมด) เหลือดาบอรุณเล่มเดียวที่เป็นดาบจริง
* `rod` เดิมแยกเป็น **staff** (สองมือ เวทแรงกว่า) กับ **wand** (มือเดียว
  แลกเวทส่วนหนึ่งกับช่อง offhand) — นี่คือการแลกที่ทำให้สองชนิดนี้ต่างกันจริง
* **shield** อยู่ในช่อง offhand ไม่ใช่ช่องอาวุธ แต่มีคลาสของตัวเองเพื่อให้
  ศิลป์โล่ถูกอ้างถึงแบบเดียวกับอาวุธอื่น
* **special** ไม่มีบันได ไม่มีอาชีพห้าม — ของไม่กี่ชิ้นที่ใครก็ถือได้

ชื่อเดิม `blade` และ `rod` ยังอ่านออกผ่าน `WEAPON_ALIASES`

อีกแปดคลาสที่เพิ่มมาได้บันไดของตัวเองครบตั้งแต่ต้นเกมถึงท้ายเกม (รวม 52 เล่ม)
เพราะคลาสที่ถือได้แค่สิบเลเวลไม่ใช่คลาส

## เอฟเฟคตีบวก

บอร์ดให้ **+0 ถึง +15** (ไม่ใช่ 4 ระดับ) แยกตามชนิดอาวุธ 8 ชนิด
บวกอีกสามหมวด:
* **ธาตุ** — Normal Fire Ice Lightning Earth Wind Holy Dark (8)
* **พิเศษ** — Critical Poison Bleed Life Steal Mana Burn Curse Heal Shield (8)
* **ตำนาน** — Dragon Flame Frost Nova Thunder God Nature Spirit Holy Light Shadow Reaper (6)
* **overlay แยกชั้น** — Glow1 Glow2 Particle Aura Slash Circle Flare Spark (8)

เกมทำครบทั้งสี่หมวดแล้วที่ `shared/refineglow.js` และสี่หมวดนี้เป็นคนละชั้นกันจริงๆ
ซ้อนกันได้หมด เพราะมันตอบคนละคำถาม:

| ชั้น | ตอบว่า | อยู่ที่ไหน |
|---|---|---|
| ขั้นตีบวก | *ลงทุนไปเท่าไหร่* | `GLOW_TIERS` — 15 ขั้น ขั้นละเลเวล |
| ธาตุ | *มันคืออะไร* | `shared/elements.js` |
| เครื่องหมายพิเศษ | *มันทำอะไรกับคนโดน* | `SPECIAL_MARKS` (8) |
| ลายเซ็นตำนาน | ของระดับตำนานหนึ่งลาย | `SIGNATURES` (6) |

ขั้นตีบวกเคยมี 7 ขั้นทั้งที่เพดานคือ +15 แปลว่าแปดเลเวลที่คนจ่ายเงินไปหน้าตา
เหมือนเลเวลล่างเป๊ะ ตอนนี้ทุกเลเวลมีหน้าตาของตัวเอง แบ่งเป็นสามช่วง:
**ไฟ +1..+7** · **สนธยา +8..+11** (ช่วงที่ตีบวกพลาดแล้วของพัง) ·
**นิรันดร์ +12..+15** เพดาน `MAX_REFINE` อยู่ที่เดียวและเซิร์ฟเวอร์อ่านจากที่นั่น

**overlay ทั้ง 8** (Glow1 Glow2 Particle Aura Slash Circle Flare Spark) เป็น
ชิ้นส่วนที่ขั้นหนึ่งประกาศว่าตัวเองใช้อันไหนบ้าง (`layers`) renderer จึงอ่านจาก
ตารางแทนการไล่ `if (tier.at >= n)` — และใส่ศิลป์ทีละชิ้นได้

เครื่องหมายพิเศษสองตัว (คริติคอล ดูดเลือด) อ่านจากตัวเลขในไอเทมโดยตรง จึงโกหก
ไม่ได้ ที่เหลือไอเทมประกาศเอง (`marks: ['poison']`) และมีเทสต์บังคับว่าทั้งแปด
ต้องมีของจริงในโลกสวมอยู่อย่างน้อยชิ้นหนึ่ง ส่วนลายเซ็นตำนานเลือกจาก**ธาตุ**
ของชิ้นนั้น ของตำนานที่เพิ่มเข้ามาทีหลังจึงได้ลายที่ถูกต้องเองโดยไม่ต้องแก้ตาราง

ธาตุในเกมตอนนี้คือแปดตัวเดียวกับบอร์ด: `neutral fire ice lightning earth wind
holy dark` ชื่อเดิมหกตัว (ember frost storm verdant shade radiant) กลายเป็น
alias ที่ `shared/elements.js` แปลงให้เอง เซฟเก่าจึงยังอ่านออกทั้งสีและดาเมจ

## สกิล
บอร์ดมี 24 เอฟเฟค เฟรมละ ~5: Basic Attack, Power Slash, Spin Attack, Pierce, Arrow Shot,
Multi Shot, Fire Ball, Fire Storm, Ice Shard, Blizzard, Lightning, Thunder Strike,
Wind Cutter, Tornado, Earth Spike, Meteor, Poison, Darkness, Heal, Buff, Shield,
Teleport, Summon, Ultimate

เกมมี 59 สกิล วาดเอฟเฟคด้วยโค้ดทั้งหมด (`client/js/skillfx.js`) — ของใหม่จะมาแทนหรือเสริมก็ได้

## NPC
18 อาชีพ: Merchant Blacksmith Storage Innkeeper Healer Quest Guild Master Guard Royal
Teacher Event Pet Hair Stylist Costume Makeup Teleport Bank Event Shop
\+ ไอคอนป้ายหัว 12 แบบ และ portrait สำหรับกล่องสนทนา

เกมมี NPC 12 ตัว ตรงกันเกือบหมด

## สิ่งที่แก้ให้แล้ว

- [x] **8 ทิศ** — ทั้งเซิร์ฟเวอร์คำนวณเป็น 8 แล้ว (`shared/facing.js`)
      ศิลป์ LPC เดิมยังใช้ได้ เพราะ layout 4 แถวจะพับ 8 ทิศลงเป็น 4 ให้เอง
      (ทแยงอ่านเป็นซ้าย/ขวา ซึ่งดูดีกว่าหันเข้ากล้อง)
- [x] **เฟรมขนาดอื่น** — 128×128 ประกาศได้ ไม่ต้องแก้ renderer
- [x] **pivot ล่างกลาง** — `anchor: 1.0` ใน layout
- [x] **ชื่อท่าไม่ตรง** — ระบบ alias
- [x] **ลำดับชั้นต่างกัน** — แต่ละ layout ถือลำดับของตัวเอง
- [x] layout `chibi8` ร่างไว้แล้วใน `shared/sheets.js`

## สิ่งที่ยังต้องรู้จากไฟล์จริง

1. **แพ็กเป็นชีตเดียว หรือแยกไฟล์ต่อเฟรม?** สเปกเขียนว่า "PNG Sequence"
   ถ้าแยกไฟล์ ต้องทำตัวโหลดคนละแบบกับตอนนี้ (ตอนนี้อ่านชีตเดียวแล้วตัดเป็นตาราง)
2. **กี่เฟรมต่อท่า** — บอร์ดโชว์ช่องละภาพเดียว บอกไม่ได้ว่าท่าเดินมีกี่เฟรม
   `chibi8` จึงตั้ง `frames: 1` ไว้ก่อน รอวัดจากไฟล์จริง
3. **ชีตเรียงยังไง** — ท่าเป็นแถวแล้วทิศเป็นคอลัมน์ หรือกลับกัน
   หรือหนึ่งไฟล์ต่อหนึ่งท่า

ข้อ 1-3 ตอบได้ทันทีที่เห็นไฟล์จริงหนึ่งไฟล์ — รัน `npm run sheet -- ไฟล์.png`
