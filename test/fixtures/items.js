// A bench of items for the tests that exercise the item *systems* - shops,
// refining, cards, crafting, boxes, the shrine. The game's own item table is
// empty while it waits for the new item sheet, so these tests bring their
// own: a slice of the previous item set, frozen here as test data only.
// Nothing under test/ is loaded by the game.
//
// Importing this module installs the bench into the live tables; each test
// file runs in its own process, so it never leaks into another.
import { ITEMS, CARDS, RECIPES, CRAFTING_INPUTS } from '../../shared/data/items.js';
import { SHOPS } from '../../shared/data/npcs.js';
import { GACHA } from '../../server/game/economy.js';

export const BENCH_ITEMS = {
  antidote: {"type":"consumable","stack":99,"weight":4,"id":"antidote","name":"Antidote","nameTh":"ยาถอนพิษ","cleanse":["poison"],"cooldown":5,"level":1,"value":150,"rarity":"common"},
  ashen_edge: {"type":"weapon","slot":"weapon","refinable":true,"durability":120,"stack":1,"id":"ashen_edge","name":"Ashen Edge","nameTh":"คมเถ้าธุลี","wclass":"dagger","atk":86,"delay":0.68,"range":40,"level":60,"weight":75,"value":168000,"rarity":"epic","element":"dark","stats":{"agi":4,"luk":3},"crit":10,"lifesteal":3,"marks":["curse"],"sprite":{"layer":"weapon","key":"dagger","gendered":true},"desc":"ตกจากราชันโครงกระดูกเท่านั้น"},
  ashguard_plate: {"type":"armor","refinable":true,"durability":150,"stack":1,"id":"ashguard_plate","name":"Ashguard Plate","nameTh":"เกราะเถ้าผู้พิทักษ์","slot":"torso","def":74,"mdef":24,"level":62,"weight":400,"value":240000,"rarity":"epic","stats":{"vit":6,"str":3},"element":"fire","sprite":{"layer":"torso","key":"plate","gendered":true}},
  ashwood_pike: {"type":"weapon","slot":"weapon","refinable":true,"durability":120,"stack":1,"id":"ashwood_pike","name":"Ashwood Pike","nameTh":"ทวนไม้เถ้า","wclass":"spear","atk":30,"delay":1.02,"range":72,"level":9,"weight":90,"value":1500,"rarity":"common","sprite":{"layer":"weapon","key":"spear","gendered":true}},
  blessing_oil: {"type":"material","stack":999,"weight":2,"id":"blessing_oil","name":"Blessing Oil","nameTh":"น้ำมันศักดิ์สิทธิ์","value":12000,"rarity":"rare","desc":"กันของหายเมื่อตีบวกล้มเหลว 1 ครั้ง"},
  boss_casket: {"type":"consumable","stack":99,"weight":3,"id":"boss_casket","name":"Warlord's Casket","nameTh":"หีบของจอมทัพ","level":1,"value":24000,"rarity":"epic","cooldown":0,"box":true,"desc":"หีบที่บอสหวงไว้ — ข้างในมีตั้งแต่ของดีไปจนถึงปีก","opens":[{"id":"runed_whetstone","qty":[2,4],"weight":24},{"id":"blessing_oil","qty":[1,2],"weight":20},{"id":"shard_dawn","qty":[2,5],"weight":18},{"id":"steel_ingot","qty":[4,8],"weight":14},{"id":"emberheart_amulet","qty":1,"weight":8},{"id":"wings_feather","qty":1,"weight":6},{"id":"wings_raven","qty":1,"weight":6},{"id":"wings_bat","qty":1,"weight":3},{"id":"wings_frost","qty":1,"weight":1}]},
  card_choir: {"type":"card","stack":99,"weight":1,"refinable":false,"id":"card_choir","name":"Choirmaster Card","nameTh":"การ์ดผู้นำขับร้อง","value":140000,"rarity":"epic","fits":"any","card":{"stats":{"int":4},"sp":120},"desc":"INT +4 และ SP +120"},
  card_grub: {"type":"card","stack":99,"weight":1,"refinable":false,"id":"card_grub","name":"Stone Grub Card","nameTh":"การ์ดหนอนหิน","value":52000,"rarity":"rare","fits":"weapon","card":{"size":{"large":0.25}},"desc":"ดาเมจต่อเป้าหมายขนาดใหญ่ +25%"},
  card_husk: {"type":"card","stack":99,"weight":1,"refinable":false,"id":"card_husk","name":"Husk Card","nameTh":"การ์ดซากเถ้า","value":42000,"rarity":"rare","fits":"weapon","card":{"race":{"undead":0.2}},"desc":"ดาเมจต่ออันเดด +20%"},
  card_moth: {"type":"card","stack":99,"weight":1,"refinable":false,"id":"card_moth","name":"Grave Moth Card","nameTh":"การ์ดผีเสื้อสุสาน","value":48000,"rarity":"rare","fits":"weapon","card":{"size":{"small":0.25}},"desc":"ดาเมจต่อเป้าหมายขนาดเล็ก +25%"},
  card_wight: {"type":"card","stack":99,"weight":1,"refinable":false,"id":"card_wight","name":"Frost Wight Card","nameTh":"การ์ดภูตเยือกแข็ง","value":64000,"rarity":"epic","fits":"armor","card":{"stats":{"vit":3},"mdef":12},"desc":"VIT +3 และ MDEF +12"},
  emberheart_amulet: {"type":"armor","refinable":false,"durability":150,"stack":1,"id":"emberheart_amulet","name":"Emberheart Amulet","nameTh":"จี้หัวใจอังคาร","slot":"accessory","level":48,"weight":6,"value":130000,"rarity":"epic","stats":{"str":3,"int":3,"vit":2},"hp":150,"sp":60},
  greater_salve: {"type":"consumable","stack":99,"weight":4,"id":"greater_salve","name":"Greater Salve","nameTh":"ยาสมานใหญ่","heal":260,"cooldown":6,"level":25,"value":470,"rarity":"common"},
  herb_bundle: {"type":"material","stack":999,"weight":2,"id":"herb_bundle","name":"Herb Bundle","nameTh":"มัดสมุนไพร","value":45,"rarity":"common"},
  iron_arrow: {"id":"iron_arrow","name":"Iron Arrow","nameTh":"ลูกธนูเหล็ก","type":"ammo","ammoFor":"bow","atk":9,"stack":2000,"weight":0.3,"value":7,"rarity":"common","sprite":{"layer":"weapon","key":"arrow","gendered":false}},
  iron_ore: {"type":"material","stack":999,"weight":2,"id":"iron_ore","name":"Iron Ore","nameTh":"แร่เหล็ก","value":160,"rarity":"common"},
  iron_pike: {"type":"weapon","slot":"weapon","refinable":true,"durability":120,"stack":1,"id":"iron_pike","name":"Iron Pike","nameTh":"หอกเหล็ก","wclass":"spear","atk":38,"delay":1.02,"range":68,"level":12,"weight":110,"value":3100,"rarity":"common","sprite":{"layer":"weapon","key":"spear","gendered":true}},
  iron_sword: {"type":"weapon","slot":"weapon","refinable":true,"durability":120,"stack":1,"id":"iron_sword","name":"Iron Sword","nameTh":"ดาบเหล็ก","wclass":"sword","atk":17,"delay":0.88,"range":46,"level":1,"weight":65,"value":300,"rarity":"common","sprite":{"layer":"weapon","key":"dagger","gendered":true,"tint":"#c8ccd4"},"desc":"ดาบมือเดียวธรรมดา หนักกว่ามีดแต่ก็ฟันได้เต็มแรงกว่า"},
  leather_vest: {"type":"armor","refinable":true,"durability":150,"stack":1,"id":"leather_vest","name":"Leather Vest","nameTh":"เสื้อหนัง","slot":"torso","def":20,"level":16,"weight":90,"value":4400,"rarity":"common","sprite":{"layer":"torso","key":"leather","gendered":true}},
  lesser_salve: {"type":"consumable","stack":99,"weight":4,"id":"lesser_salve","name":"Lesser Salve","nameTh":"ยาสมานเล็ก","heal":90,"cooldown":4,"level":1,"value":120,"rarity":"common","desc":"ฟื้น 90 HP - แพงเมื่อเทียบกับรายได้ ใช้ให้คุ้ม"},
  mana_draught: {"type":"consumable","stack":99,"weight":4,"id":"mana_draught","name":"Mana Draught","nameTh":"น้ำมานา","healSp":80,"cooldown":8,"level":10,"value":400,"rarity":"common"},
  mystery_scroll: {"type":"consumable","stack":99,"weight":1,"id":"mystery_scroll","name":"Mystery Scroll","nameTh":"ม้วนปริศนา","level":1,"value":900,"rarity":"uncommon","cooldown":0,"box":true,"desc":"ม้วนกระดาษผนึกไว้ ไม่มีใครรู้ว่าข้างในเป็นอะไรจนกว่าจะแกะ","opens":[{"id":"lesser_salve","qty":[3,6],"weight":22},{"id":"herb_bundle","qty":[5,12],"weight":18},{"id":"iron_ore","qty":[2,6],"weight":16},{"id":"greater_salve","qty":[2,4],"weight":12},{"id":"mana_draught","qty":[2,4],"weight":10},{"id":"steel_ingot","qty":[1,2],"weight":8},{"id":"runed_whetstone","qty":1,"weight":7},{"id":"blessing_oil","qty":1,"weight":4},{"id":"shard_dawn","qty":1,"weight":3}]},
  reliquary_seal: {"type":"material","stack":999,"weight":2,"id":"reliquary_seal","name":"Reliquary Seal","nameTh":"ตราผนึกหีบศพ","value":4200,"rarity":"rare","element":"holy","desc":"ตราที่ผนึกหีบศพไว้ ใช้หลอมเป็นน้ำมันศักดิ์สิทธิ์ได้ — หาได้จากหีบศพจมเท่านั้น"},
  runed_whetstone: {"type":"material","stack":999,"weight":2,"id":"runed_whetstone","name":"Runed Whetstone","nameTh":"หินลับรูน","value":2600,"rarity":"uncommon","desc":"วัตถุดิบตีบวก +4 ขึ้นไป"},
  shard_dawn: {"type":"material","stack":999,"weight":2,"id":"shard_dawn","name":"Dawn Shard","nameTh":"เศษรุ่งอรุณ","value":8000,"rarity":"rare","desc":"ใช้ชุบชีวิต และเป็นวัตถุดิบตีบวกขั้นสูง"},
  skeleton_crown: {"type":"material","stack":999,"weight":2,"id":"skeleton_crown","name":"Cracked Crown","nameTh":"มงกุฎร้าว","value":60000,"rarity":"epic","desc":"ของจากบอส - มีค่ามากในตลาดผู้เล่น"},
  steel_ingot: {"type":"material","stack":999,"weight":2,"id":"steel_ingot","name":"Steel Ingot","nameTh":"แท่งเหล็กกล้า","value":750,"rarity":"common","craftable":true},
  training_blade: {"type":"weapon","slot":"weapon","refinable":true,"durability":120,"stack":1,"id":"training_blade","name":"Training Blade","nameTh":"มีดฝึกหัด","wclass":"dagger","atk":12,"delay":0.85,"range":40,"level":1,"weight":40,"value":180,"rarity":"common","sprite":{"layer":"weapon","key":"dagger","gendered":true},"desc":"มีดสั้นสำหรับผู้เริ่มต้น"},
  warp_scroll: {"type":"consumable","stack":99,"weight":4,"id":"warp_scroll","name":"Warp Scroll","nameTh":"ม้วนวาร์ป","warp":"lastTown","cast":3,"cooldown":60,"level":1,"value":900,"rarity":"common","desc":"กลับเมืองล่าสุด - ค่าเดินทางคือหนึ่งในบ่อดูดเงินหลัก"},
  wings_bat: {"type":"armor","refinable":false,"stack":1,"id":"wings_bat","name":"Duskfang Wings","nameTh":"ปีกค้างคาวสนธยา","slot":"wings","level":30,"weight":7,"value":120000,"rarity":"epic","wing":{"style":"bat","scale":1.05},"stats":{"str":2,"agi":2},"crit":2,"desc":"หนังปีกบางเฉียบ ได้ยินเสียงลมทุกครั้งที่ขยับ"},
  wings_dawn: {"type":"armor","refinable":false,"stack":1,"id":"wings_dawn","name":"Dawnbringer Wings","nameTh":"ปีกผู้นำรุ่งอรุณ","slot":"wings","level":60,"weight":8,"value":700000,"rarity":"legendary","wing":{"style":"dawn","scale":1.15},"stats":{"str":2,"agi":2,"int":2,"vit":2},"hp":200,"sp":80,"speed":5,"desc":"แสงแรกของวัน ที่มีคนเพียงไม่กี่คนในเซิร์ฟเวอร์เคยได้ถือ"},
  wings_ember: {"type":"armor","refinable":false,"stack":1,"id":"wings_ember","name":"Emberfall Wings","nameTh":"ปีกเปลวอังคาร","slot":"wings","level":50,"weight":8,"value":380000,"rarity":"legendary","wing":{"style":"ember","scale":1.1},"stats":{"str":3,"agi":3},"atk":12,"speed":4,"desc":"ไฟที่ไม่ไหม้เจ้าของ — แต่ไหม้ทุกอย่างที่เข้ามาใกล้"},
  wings_feather: {"type":"armor","refinable":false,"stack":1,"id":"wings_feather","name":"Seraph Wings","nameTh":"ปีกนางฟ้า","slot":"wings","level":20,"weight":6,"value":60000,"rarity":"rare","wing":{"style":"feather","scale":1},"stats":{"agi":2},"speed":3,"desc":"ขนนกสีนวล เบาจนแทบไม่รู้สึกว่ามีอะไรอยู่บนหลัง"},
  wings_frost: {"type":"armor","refinable":false,"stack":1,"id":"wings_frost","name":"Rimeglass Wings","nameTh":"ปีกแก้วน้ำแข็ง","slot":"wings","level":40,"weight":8,"value":220000,"rarity":"epic","wing":{"style":"frost","scale":1.05},"stats":{"int":3,"vit":2},"sp":60,"mdef":4,"desc":"ผลึกที่ไม่ละลาย แม้จะอยู่ในมือของคนเป็น"},
  wings_raven: {"type":"armor","refinable":false,"stack":1,"id":"wings_raven","name":"Raven Wings","nameTh":"ปีกอีกา","slot":"wings","level":20,"weight":6,"value":60000,"rarity":"rare","wing":{"style":"raven","scale":1},"stats":{"agi":2,"luk":1},"flee":8,"desc":"ดำสนิทจนกลืนไปกับกลางคืน"},
  wooden_arrow: {"id":"wooden_arrow","name":"Wooden Arrow","nameTh":"ลูกธนูไม้","type":"ammo","ammoFor":"bow","atk":3,"stack":2000,"weight":0.2,"value":2,"rarity":"common","sprite":{"layer":"weapon","key":"arrow","gendered":false}},
};

export const BENCH_RECIPES = {
  steel_ingot: {"out":{"id":"steel_ingot","qty":1},"in":[{"id":"iron_ore","qty":3}],"fee":60,"station":"forge"},
  blessing_oil_seal: {"out":{"id":"blessing_oil","qty":1},"in":[{"id":"reliquary_seal","qty":6}],"fee":2000,"station":"forge"},
};

const GENERAL = [{"id":"lesser_salve","stock":40,"restock":300},{"id":"antidote","stock":20,"restock":300},{"id":"mana_draught","stock":20,"restock":300},{"id":"warp_scroll","stock":10,"restock":600},{"id":"wooden_arrow","stock":4000,"restock":120},{"id":"iron_arrow","stock":1200,"restock":300}];
const DAWN = [{"id":"runed_whetstone","stock":999,"price":1},{"id":"blessing_oil","stock":999,"price":2},{"id":"mystery_scroll","stock":999,"price":1},{"id":"boss_casket","stock":999,"price":8},{"id":"wings_feather","stock":99,"price":30},{"id":"wings_raven","stock":99,"price":30},{"id":"wings_bat","stock":99,"price":55},{"id":"wings_frost","stock":99,"price":80},{"id":"wings_ember","stock":99,"price":140},{"id":"wings_dawn","stock":99,"price":260}];
const POOL = [{"id":"runed_whetstone","qty":[1,3],"weight":26,"grade":"R","tier":"common"},{"id":"greater_salve","qty":[5,10],"weight":16,"grade":"R","tier":"common"},{"id":"mana_draught","qty":[5,10],"weight":12,"grade":"R","tier":"common"},{"id":"blessing_oil","qty":[1,2],"weight":14,"grade":"SR","tier":"common"},{"id":"mystery_scroll","qty":[2,4],"weight":10,"grade":"SR","tier":"common"},{"id":"boss_casket","qty":1,"weight":6,"grade":"SSR","tier":"rare"},{"id":"wings_feather","qty":1,"weight":5,"grade":"SSR","tier":"rare"},{"id":"wings_raven","qty":1,"weight":5,"grade":"SSR","tier":"rare"},{"id":"wings_bat","qty":1,"weight":3,"grade":"UR","tier":"rare"},{"id":"wings_frost","qty":1,"weight":2,"grade":"UR","tier":"rare"},{"id":"wings_ember","qty":1,"weight":0.8,"grade":"LR","tier":"legendary"},{"id":"wings_dawn","qty":1,"weight":0.2,"grade":"LR","tier":"legendary"}];
const MILESTONES = [{"at":50,"items":[{"id":"runed_whetstone","qty":3}]},{"at":100,"items":[{"id":"blessing_oil","qty":2}]},{"at":150,"items":[{"id":"boss_casket","qty":1}]},{"at":200,"items":[{"id":"wings_frost","qty":1}]}];

Object.assign(ITEMS, BENCH_ITEMS);
for (const [id, def] of Object.entries(BENCH_ITEMS)) if (def.type === 'card') CARDS[id] = def;
Object.assign(RECIPES, BENCH_RECIPES);
for (const r of Object.values(BENCH_RECIPES)) for (const i of r.in) CRAFTING_INPUTS.add(i.id);
SHOPS.general.stock.push(...GENERAL);
SHOPS.dawn.stock.push(...DAWN);
GACHA.pool.push(...POOL);
GACHA.milestones.splice(0, GACHA.milestones.length, ...MILESTONES);
