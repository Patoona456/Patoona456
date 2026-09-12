/* =============================================================
   AETHERION ONLINE — เอนจินเกมหลัก
   ระบบเลือกทาง / ต่อสู้ผลัดตา / ไต่ชั้นฟ้า 9 ชั้น / Auto-AI
   ============================================================= */
(function (global) {
  'use strict';

  var D = global.GameData;
  var Art = global.Art;

  var $ = function (s) { return document.querySelector(s); };
  var el = function (t, c, txt) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (txt != null) e.textContent = txt;
    return e;
  };

  var SAVE_KEY = 'aetherion.save.v1';

  /* ---------------- สถานะเกม ---------------- */
  var S = null;

  function newState() {
    return {
      name: 'ผู้เล่นนิรนาม',
      cls: null,
      lvl: 1, exp: 0, next: 100,
      hp: 100, maxhp: 100, ep: 50, maxep: 50,
      atk: 15, def: 10, spd: 10, luck: 8,
      memory: 100, deaths: 0,
      fame: 0, trust: 0, insight: 0, resolve: 0,
      allies: [], items: { ether_vial: 3, echo_salt: 2, memory_shard: 1, anchor_coin: 120 },
      skills: [], stratum: 1, kills: 0, turn: 0,
      flags: {}, node: 'boot', battle: null, log: [],
      auto: false, persona: 'balanced', playtime: 0
    };
  }

  /* ---------------- ตัวช่วย ---------------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }

  function expNeeded(lvl) { return Math.round(100 * Math.pow(1.35, lvl - 1)); }

  function grantExp(n) {
    S.exp += n;
    var ups = 0;
    while (S.exp >= S.next) {
      S.exp -= S.next;
      S.lvl++; ups++;
      S.next = expNeeded(S.lvl);
      var b = D.CLASSES[S.cls].base;
      S.maxhp += Math.round(b.hp * 0.09);
      S.maxep += Math.round(b.ep * 0.08);
      S.atk += Math.round(1 + b.atk * 0.06);
      S.def += Math.round(0.6 + b.def * 0.05);
      S.spd += 0.4; S.luck += 0.3;
      S.hp = S.maxhp; S.ep = S.maxep;
      if (S.lvl === 8 && S.skills.indexOf('null_verse') < 0) S.skills.push('null_verse');
      if (S.lvl === 15 && S.skills.indexOf('last_login') < 0) S.skills.push('last_login');
    }
    if (ups) toast('เลเวลอัป! → Lv.' + S.lvl, 'good');
  }

  function applyEffect(fx) {
    if (!fx) return;
    if (fx.exp) grantExp(fx.exp);
    if (fx.hp) S.hp = clamp(S.hp + fx.hp, 1, S.maxhp);
    if (fx.ep) S.ep = clamp(S.ep + fx.ep, 0, S.maxep);
    if (fx.memory) S.memory = clamp(S.memory + fx.memory, 0, 100);
    ['fame', 'trust', 'insight', 'resolve'].forEach(function (k) {
      if (fx[k]) S[k] += fx[k];
    });
    if (fx.ally && S.allies.indexOf(fx.ally) < 0) {
      S.allies.push(fx.ally);
      toast('【' + fx.ally + '】เข้าร่วมปาร์ตี้', 'good');
    }
    if (fx.item) { S.items[fx.item] = (S.items[fx.item] || 0) + (fx.qty || 1); }
    if (fx.marked) S.flags.marked = true;
    if (fx.oath) S.flags.oath = true;
  }

  /* ---------------- UI: แถบสถานะ ---------------- */
  function bar(id, cur, max) {
    var pct = clamp(cur / max * 100, 0, 100);
    var fill = $(id + ' .bar-fill');
    var txt = $(id + ' .bar-text');
    if (fill) fill.style.width = pct + '%';
    if (txt) txt.textContent = Math.max(0, Math.round(cur)) + ' / ' + Math.round(max);
  }

  function renderHUD() {
    if (!S.cls) return;
    var c = D.CLASSES[S.cls];
    $('#hud-name').textContent = S.name;
    $('#hud-class').textContent = c.name + ' · Lv.' + S.lvl;
    bar('#hud-hp', S.hp, S.maxhp);
    bar('#hud-ep', S.ep, S.maxep);
    bar('#hud-exp', S.exp, S.next);
    bar('#hud-mem', S.memory, 100);
    $('#hud-stats').innerHTML = '';
    [['ATK', Math.round(S.atk)], ['DEF', Math.round(S.def)], ['SPD', Math.round(S.spd)],
     ['LUK', Math.round(S.luck)], ['ชั้นฟ้า', S.stratum + '/9'], ['ตาย', S.deaths]]
      .forEach(function (p) {
        var d = el('div', 'stat');
        d.appendChild(el('span', 'stat-k', p[0]));
        d.appendChild(el('span', 'stat-v', String(p[1])));
        $('#hud-stats').appendChild(d);
      });

    var party = $('#hud-party');
    party.innerHTML = '';
    if (S.allies.length === 0) party.appendChild(el('div', 'muted', 'เดินลำพัง'));
    S.allies.forEach(function (a) { party.appendChild(el('div', 'ally', '◈ ' + a)); });

    var inv = $('#hud-items');
    inv.innerHTML = '';
    Object.keys(S.items).forEach(function (k) {
      if (!S.items[k]) return;
      var it = D.ITEMS[k]; if (!it) return;
      var d = el('div', 'item');
      d.appendChild(el('span', 'item-n', it.name));
      d.appendChild(el('span', 'item-q', '×' + S.items[k]));
      d.title = it.desc;
      inv.appendChild(d);
    });
  }

  /* ---------------- UI: ภาพฉาก ---------------- */
  function paintScene(spec) {
    spec = spec || {};
    spec.seed = spec.seed || (S.node + ':' + S.turn + ':' + S.stratum);
    var canvas = $('#scene');
    Art.paint(canvas, spec);
    canvas.classList.remove('flash');
    void canvas.offsetWidth;
    canvas.classList.add('flash');
    $('#scene-tag').textContent = (spec.label || '') + ' · เรนเดอร์ #' + (++paintCount);
  }
  var paintCount = 0;

  function strataSpec(extra) {
    var st = D.STRATA[S.stratum - 1];
    var o = { palette: st.palette, terrain: st.terrain, label: 'ชั้น ' + st.n + ' — ' + st.name };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    if (S.memory < 50) o.glitch = Math.round((50 - S.memory) / 3);
    return o;
  }

  /* ---------------- UI: ข้อความแบบพิมพ์ทีละบรรทัด ---------------- */
  var typingTimer = null;

  function renderText(title, lines, done) {
    clearTimeout(typingTimer);
    $('#scene-title').textContent = title;
    var box = $('#story');
    box.innerHTML = '';
    var i = 0;
    (function step() {
      if (i >= lines.length) { if (done) done(); return; }
      var p = el('p', 'line', lines[i]);
      box.appendChild(p);
      box.scrollTop = box.scrollHeight;
      i++;
      typingTimer = setTimeout(step, S.auto ? 380 : 260);
    })();
  }

  function skipTyping(title, lines) {
    clearTimeout(typingTimer);
    var box = $('#story');
    box.innerHTML = '';
    lines.forEach(function (l) { box.appendChild(el('p', 'line', l)); });
    box.scrollTop = box.scrollHeight;
  }

  function toast(msg, kind) {
    var t = el('div', 'toast ' + (kind || ''), msg);
    $('#toasts').appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }

  function logLine(msg, kind) {
    S.log.push(msg);
    if (S.log.length > 200) S.log.shift();
    var box = $('#combat-log');
    if (!box) return;
    box.appendChild(el('div', 'log-line ' + (kind || ''), msg));
    box.scrollTop = box.scrollHeight;
  }

  /* ---------------- UI: ตัวเลือก ---------------- */
  var autoTimer = null;

  function renderChoices(choices) {
    clearTimeout(autoTimer);
    var box = $('#choices');
    box.innerHTML = '';
    choices.forEach(function (ch, idx) {
      if (ch.require && !ch.require()) return;
      var b = el('button', 'choice');
      b.appendChild(el('span', 'choice-key', String(idx + 1)));
      var body = el('div', 'choice-body');
      body.appendChild(el('div', 'choice-text', ch.text));
      if (ch.tag) body.appendChild(el('div', 'choice-tag', '[' + ch.tag + ']'));
      if (ch.hint) body.appendChild(el('div', 'choice-hint', ch.hint));
      b.appendChild(body);
      b.onclick = function () { takeChoice(ch); };
      box.appendChild(b);
    });
    if (S.auto && choices.length) {
      var delay = 900 + Math.min(choices.length, 5) * 220;
      autoTimer = setTimeout(function () {
        var chosen = autoPick(choices);
        var nodes = box.querySelectorAll('.choice');
        var i = choices.indexOf(chosen);
        if (nodes[i]) nodes[i].classList.add('auto-picked');
        setTimeout(function () { takeChoice(chosen); }, 420);
      }, delay);
    }
  }

  function takeChoice(ch) {
    clearTimeout(autoTimer);
    S.turn++;
    if (ch.effect) applyEffect(ch.effect);
    if (ch.run) { ch.run(); }
    if (ch.to) goto(ch.to);
    renderHUD();
    save();
  }

  /* ---------------- Auto-AI: ตรรกะเลือกเอง ---------------- */
  function autoPick(choices) {
    var scored = choices.map(function (ch) {
      var s = 1 + Math.random() * 0.8;
      var t = (ch.tag || '') + ' ' + ch.text;

      // ความอยู่รอดมาก่อน
      if (S.hp / S.maxhp < 0.35) {
        if (/หนี|ถอย|พัก|ฟื้น|ยา|รักษา/.test(t)) s += 6;
        if (/บุก|ท้า|สู้|บอส/.test(t)) s -= 4;
      }
      if (S.memory < 35 && /ความทรงจำ|พัก|เศษ/.test(t)) s += 4;

      // บุคลิกของ AI
      if (S.persona === 'aggressive' && /บุก|ฟัน|โจมตี|ท้า|ล่า|สู้/.test(t)) s += 3;
      if (S.persona === 'cautious' && /วิเคราะห์|รอบคอบ|ฝึก|ถอย|ระวัง|พัก/.test(t)) s += 3;
      if (S.persona === 'kind' && /ช่วย|เมตตา|เพื่อน|ปกป้อง|อ่อนโยน|จริงใจ/.test(t)) s += 3;
      if (S.persona === 'balanced') s += 0.5;

      // เดินหน้าเนื้อเรื่องเสมอ
      if (ch.weight) s += ch.weight;
      return { ch: ch, s: s };
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored[0].ch;
  }

  /* ---------------- สร้างตัวละคร ---------------- */
  function nodeCreate() {
    paintScene({ palette: 'dawn', terrain: 'spires', figures: 0, mood: 'calm', label: 'ห้องสร้างตัวละคร' });
    var lines = [
      'แสงสีทองห่อหุ้มร่างเธอไว้ในห้องที่ไม่มีพื้นและไม่มีเพดาน',
      'เสียงไร้เพศดังขึ้น: "เลือกรูปแบบการดำรงอยู่ของเธอในเอธีเรียน"',
      'มันไม่ได้ถามว่าเธออยากเป็นอะไร — มันถามว่าเธอจะ "รอด" แบบไหน'
    ];
    renderText('เลือกวิถีของเธอ', lines);
    var choices = Object.keys(D.CLASSES).map(function (k) {
      var c = D.CLASSES[k];
      return {
        text: c.name + ' — ' + c.tag,
        tag: 'HP' + c.base.hp + ' ATK' + c.base.atk + ' SPD' + c.base.spd,
        hint: c.desc,
        run: function () { chooseClass(k); },
        to: 'trapped'
      };
    });
    renderChoices(choices);
  }

  function chooseClass(k) {
    var c = D.CLASSES[k];
    S.cls = k;
    S.maxhp = c.base.hp; S.hp = c.base.hp;
    S.maxep = c.base.ep; S.ep = c.base.ep;
    S.atk = c.base.atk; S.def = c.base.def;
    S.spd = c.base.spd; S.luck = c.base.luck;
    S.skills = c.skills.slice();
    var nameInput = $('#player-name').value.trim();
    if (nameInput) S.name = nameInput;
    toast('เธอคือ ' + c.name, 'good');
  }

  /* ---------------- ฮับของชั้นฟ้า ---------------- */
  function nodeStrataGate() {
    var st = D.STRATA[S.stratum - 1];
    paintScene(strataSpec({ figures: 2, mood: 'calm' }));
    var lines = [
      '— ชั้นฟ้าที่ ' + st.n + ' : ' + st.name + ' —',
      pick([
        'ลมอีเธอร์พัดผ่านสะพานหินที่ลอยอยู่เหนือความว่างเปล่า',
        'ผู้เล่นที่รอดมาถึงที่นี่เดินสวนกันโดยไม่สบตาใคร',
        'ป้ายประกาศของกิลด์เต็มไปด้วยชื่อคนที่ไม่กลับมาแล้ว',
        'เสียงระฆังจากหอคอยกลางดังขึ้นทุกชั่วโมง นับจำนวนคนที่เหลือ'
      ]),
      'ผู้รอดชีวิตที่เหลือในเซิร์ฟเวอร์: ' + survivors().toLocaleString('th-TH') + ' คน',
      'สิ่งที่เธอจะทำต่อไปเป็นของเธอเอง'
    ];
    renderText('ชั้น ' + st.n + ' — ' + st.name, lines);

    var choices = [
      { text: 'ออกล่ามอนสเตอร์เก็บเลเวล', tag: 'ล่า', to: 'battle', weight: 1.6 },
      { text: 'สำรวจพื้นที่ลึกเข้าไป', tag: 'สำรวจ', to: 'explore', weight: 1.3 },
      { text: 'แวะตลาดลอย ซื้อเสบียง', tag: 'เตรียมตัว', to: 'market' },
      { text: 'ตั้งแคมป์ พักฟื้น', tag: 'พัก', to: 'rest' },
      {
        text: '⚔ ท้าบอสประจำชั้น: ' + st.boss.name,
        tag: 'ชี้ชะตา', hint: st.boss.line, to: 'boss',
        weight: S.lvl >= S.stratum * 2 + 1 ? 2.4 : -2
      }
    ];
    renderChoices(choices);
  }

  function survivors() {
    var base = 100000000;
    var lost = Math.round(base * (0.11 + (S.stratum - 1) * 0.075) + S.kills * 137);
    return Math.max(1200, base - lost);
  }

  function nodeExplore() {
    var st = D.STRATA[S.stratum - 1];
    paintScene(strataSpec({ figures: 1, mood: 'tense' }));
    var ev = pick(['treasure', 'npc', 'trap', 'lore', 'ambush']);
    var lines, choices;

    if (ev === 'treasure') {
      lines = ['เธอพบหีบที่ถูกฝังอยู่ใต้รากของสิ่งที่เคยเป็นบ้าน',
               'ข้างในมีของที่ยังใช้ได้ และจดหมายที่เขียนค้างไว้ครึ่งฉบับ'];
      choices = [
        { text: 'เก็บของแล้วอ่านจดหมาย', tag: 'อยากรู้', to: 'strata_gate',
          effect: { item: 'ether_vial', qty: 2, insight: 1, memory: 2 } },
        { text: 'เก็บของ ไม่อ่าน — ความทรงจำคนอื่นหนักเกินไป', tag: 'เย็นชา', to: 'strata_gate',
          effect: { item: 'ether_vial', qty: 3 } }
      ];
    } else if (ev === 'npc') {
      var who = pick(['ช่างตีดาบไร้ชื่อ', 'เด็กที่จำพ่อแม่ไม่ได้แล้ว', 'นักบวชแห่งเสียงสะท้อน', 'พ่อค้าเร่ผู้ยิ้มมากเกินไป']);
      lines = ['【' + who + '】เดินเข้ามาหาเธอโดยไม่กลัวเลยแม้แต่น้อย',
               '"ช่วยฉันหน่อยได้ไหม แล้วฉันจะให้สิ่งที่เธอต้องการ"'];
      choices = [
        { text: 'ช่วยโดยไม่ขออะไรตอบแทน', tag: 'เมตตา', to: 'strata_gate',
          effect: { trust: 12, memory: 3, item: 'memory_shard' } },
        { text: 'ต่อรองราคาก่อน', tag: 'นักธุรกิจ', to: 'strata_gate',
          effect: { item: 'anchor_coin', qty: 180, fame: 3 } },
        { text: 'เดินผ่านไป มีเรื่องต้องทำ', tag: 'เย็นชา', to: 'battle', effect: { resolve: 4 } }
      ];
    } else if (ev === 'trap') {
      lines = ['พื้นใต้เท้าเธอเปลี่ยนเป็นตารางสีแดงกะทันหัน',
               '【กับดักระบบ: สนามลบข้อมูล】'];
      choices = [
        { text: 'กระโดดออกด้วยสัญชาตญาณ', tag: 'ไว', to: 'strata_gate',
          effect: S.spd > 13 ? { exp: 40 } : { hp: -30, memory: -4 } },
        { text: 'ยืนนิ่ง ปล่อยให้มันสแกนจนจบ', tag: 'เสี่ยง', to: 'strata_gate',
          effect: { insight: 3, memory: -6 } }
      ];
    } else if (ev === 'lore') {
      lines = [pick([
        'บนกำแพงหินมีรอยขีดนับจำนวนวัน — หยุดไว้ที่ 411 วัน ก่อนเกมเปิดตัว',
        'เธอพบล็อกระบบเก่า: 「มิวส์ร้องขอสิทธิ์ผู้ดูแล — อนุมัติโดย: (ไม่มีลายเซ็น)」',
        'ศพของ NPC ตัวหนึ่งถูกเขียนทับว่า 「ตัวอย่างที่ 000 — ล้มเหลว」',
        'มีเสียงกระซิบจากอากาศว่า "เธอไม่ใช่ผู้เล่นคนแรกที่มาถึงตรงนี้"'
      ]), 'บางอย่างเกี่ยวกับโลกนี้กำลังค่อย ๆ เข้าที่ในหัวของเธอ'];
      choices = [
        { text: 'จดจำมันไว้ให้ขึ้นใจ', tag: 'ปริศนา', to: 'strata_gate', effect: { insight: 4 } },
        { text: 'ทำลายหลักฐานทิ้ง ไม่อยากให้มิวส์รู้ว่าเธอเห็น', tag: 'ระวัง', to: 'strata_gate', effect: { insight: 2, resolve: 6 } }
      ];
    } else {
      lines = ['เงาหลายเงาล้อมเธอไว้จากทุกทิศ', 'พวกมันรออยู่ตรงนี้มานานแล้ว'];
      choices = [
        { text: 'สู้ทะลุออกไป', tag: 'บุก', to: 'battle', weight: 2 },
        { text: 'ใช้ภูมิประเทศหลบหนี', tag: 'หลบ', to: 'strata_gate',
          effect: S.spd > 12 ? { exp: 25 } : { hp: -35 } }
      ];
    }
    renderText('สำรวจ — ' + st.name, lines);
    renderChoices(choices);
  }

  function nodeMarket() {
    paintScene(strataSpec({ palette: 'gold', terrain: 'city', figures: 4, mood: 'calm', label: 'ตลาดลอยฟ้า' }));
    renderText('ตลาดลอย', [
      'ร้านค้าลอยอยู่บนแผ่นหินที่หมุนช้า ๆ พ่อค้าไม่ใช่ NPC ทั้งหมด',
      'เหรียญสมอในกระเป๋าเธอ: ' + (S.items.anchor_coin || 0) + ' เหรียญ'
    ]);
    function buy(key, cost, qty) {
      return function () {
        if ((S.items.anchor_coin || 0) < cost) { toast('เหรียญไม่พอ', 'bad'); return; }
        S.items.anchor_coin -= cost;
        S.items[key] = (S.items[key] || 0) + qty;
        toast('ซื้อ ' + D.ITEMS[key].name + ' ×' + qty, 'good');
      };
    }
    renderChoices([
      { text: 'ซื้อขวดอีเธอร์ ×3 (60 เหรียญ)', tag: 'ฟื้น HP', run: buy('ether_vial', 60, 3), to: 'market' },
      { text: 'ซื้อเกลือเสียงสะท้อน ×3 (70 เหรียญ)', tag: 'ฟื้น EP', run: buy('echo_salt', 70, 3), to: 'market' },
      { text: 'ซื้อเศษความทรงจำ ×1 (200 เหรียญ)', tag: 'กู้ความทรงจำ', run: buy('memory_shard', 200, 1), to: 'market' },
      { text: 'ออกจากตลาด', tag: 'กลับ', to: 'strata_gate', weight: 2 }
    ]);
  }

  function nodeRest() {
    paintScene(strataSpec({ palette: 'night', figures: 2, mood: 'calm', label: 'แคมป์กลางคืน' }));
    S.hp = clamp(S.hp + Math.round(S.maxhp * 0.55), 0, S.maxhp);
    S.ep = clamp(S.ep + Math.round(S.maxep * 0.6), 0, S.maxep);
    var lines = [
      'กองไฟอีเธอร์สีฟ้าลุกขึ้นโดยไม่ต้องใช้ฟืน',
      S.allies.length
        ? '【' + S.allies[0] + '】นั่งอยู่ฝั่งตรงข้ามกองไฟ ไม่พูดอะไร แต่ก็ไม่ไปไหน'
        : 'ไม่มีใครเฝ้ายามให้เธอ เธอนอนโดยมือยังกำอาวุธไว้',
      'HP และ EP ฟื้นตัวบางส่วน'
    ];
    if (S.memory < 100 && Math.random() < 0.4) {
      S.memory = clamp(S.memory + 3, 0, 100);
      lines.push('ในฝัน เธอเห็นเศษเสี้ยวของบ้านหลังหนึ่ง — ความทรงจำกลับมาเล็กน้อย');
    }
    renderText('พักฟื้น', lines);
    renderChoices([{ text: 'ตื่นขึ้นมาเมื่อฟ้าสาง', tag: 'ต่อไป', to: 'strata_gate', weight: 3 }]);
  }

  /* ---------------- ระบบต่อสู้ ---------------- */
  function makeEnemy(isBoss) {
    var st = D.STRATA[S.stratum - 1];
    var scale = 1 + (S.stratum - 1) * 0.28 + (S.lvl - 1) * 0.05;
    if (isBoss) {
      var b = st.boss;
      return {
        name: b.name, hp: Math.round(b.hp * (1 + (S.lvl - 1) * 0.03)), maxhp: 0,
        atk: b.atk, def: b.def, spd: b.spd, exp: b.exp,
        boss: true, palette: st.palette, line: b.line
      };
    }
    var base = D.ENEMY_POOL[clamp(rnd(Math.min(D.ENEMY_POOL.length, S.stratum + 1)), 0, D.ENEMY_POOL.length - 1)];
    return {
      name: base.name, hp: Math.round(base.hp * scale), maxhp: 0,
      atk: Math.round(base.atk * scale), def: Math.round(base.def * scale),
      spd: base.spd, exp: Math.round(base.exp * scale),
      boss: false, palette: base.palette, line: base.line
    };
  }

  function nodeBattle(isBoss) {
    var e = makeEnemy(isBoss);
    e.maxhp = e.hp;
    S.battle = { e: e, round: 1, shield: 0, evasion: 0, bleed: 0, stun: 0 };
    paintScene(strataSpec({ boss: isBoss, figures: 1, mood: 'tense', palette: e.palette,
      label: (isBoss ? 'บอสประจำชั้น' : 'การต่อสู้') + ' — ' + e.name }));
    $('#combat').classList.add('on');
    $('#combat-log').innerHTML = '';
    renderText(isBoss ? '⚔ บอสประจำชั้น: ' + e.name : 'การต่อสู้: ' + e.name,
      [e.line, isBoss ? 'อากาศหนักจนหายใจไม่ออก — นี่คือสิ่งที่ขวางระหว่างเธอกับชั้นถัดไป'
                      : 'มันเห็นเธอแล้ว ไม่มีทางเลี่ยง']);
    renderEnemy();
    combatTurn();
  }

  function renderEnemy() {
    var b = S.battle; if (!b) return;
    $('#enemy-name').textContent = b.e.name + (b.e.boss ? ' 【BOSS】' : '');
    bar('#enemy-hp', b.e.hp, b.e.maxhp);
    $('#enemy-round').textContent = 'รอบที่ ' + b.round;
  }

  function combatTurn() {
    var b = S.battle;
    if (!b) return;
    var choices = [
      { text: 'โจมตีปกติ', tag: 'ATK', hint: 'ไม่ใช้ EP', run: function () { playerAct({ basic: true }); }, weight: 1 }
    ];
    S.skills.forEach(function (sk) {
      var s = D.SKILLS[sk];
      choices.push({
        text: s.name + ' (EP ' + s.cost + ')',
        tag: s.type.toUpperCase(), hint: s.desc,
        run: function () { playerAct({ skill: sk }); },
        weight: S.ep >= s.cost ? (s.power || 1) * 1.3 : -5
      });
    });
    if (S.items.ether_vial) {
      choices.push({ text: 'ดื่มขวดอีเธอร์ (×' + S.items.ether_vial + ')', tag: 'ฟื้น',
        run: function () { useItem('ether_vial'); },
        weight: S.hp / S.maxhp < 0.4 ? 6 : -1 });
    }
    if (S.items.echo_salt) {
      choices.push({ text: 'ใช้เกลือเสียงสะท้อน (×' + S.items.echo_salt + ')', tag: 'ฟื้น EP',
        run: function () { useItem('echo_salt'); },
        weight: S.ep < 15 ? 4 : -1 });
    }
    choices.push({ text: 'ตั้งการ์ด ลดความเสียหายครึ่งหนึ่ง', tag: 'รับ',
      run: function () { playerAct({ guard: true }); },
      weight: S.hp / S.maxhp < 0.25 ? 3 : 0 });
    if (!b.e.boss) {
      choices.push({ text: 'หนี', tag: 'ถอย', run: function () { tryFlee(); },
        weight: S.hp / S.maxhp < 0.18 ? 5 : -3 });
    }
    renderChoices(choices);
  }

  function dmg(atk, def, power, luck) {
    var base = atk * (power || 1) - def * 0.55;
    var variance = 0.85 + Math.random() * 0.3;
    var crit = Math.random() < clamp((luck || 0) / 120, 0.02, 0.35);
    var v = Math.max(1, Math.round(base * variance * (crit ? 1.9 : 1)));
    return { v: v, crit: crit };
  }

  function playerAct(act) {
    var b = S.battle; if (!b) return;
    var e = b.e;

    if (act.basic) {
      var r = dmg(S.atk, e.def, 1, S.luck);
      e.hp -= r.v;
      logLine('▸ เธอฟันเข้าใส่ ' + e.name + ' — ' + r.v + ' ดาเมจ' + (r.crit ? ' 【คริติคอล!】' : ''), r.crit ? 'crit' : 'you');
    } else if (act.skill) {
      var s = D.SKILLS[act.skill];
      if (S.ep < s.cost) { toast('EP ไม่พอ', 'bad'); combatTurn(); return; }
      S.ep -= s.cost;
      if (s.type === 'buff') {
        if (s.shield) { b.shield += s.shield; logLine('▸ ' + s.name + ' — ตั้งเกราะ ' + s.shield, 'buff'); }
        if (s.evasion) { b.evasion = s.evasion; logLine('▸ ' + s.name + ' — โอกาสหลบ ' + Math.round(s.evasion * 100) + '%', 'buff'); }
      } else {
        var hits = s.hits || 1, total = 0, anyCrit = false;
        for (var i = 0; i < hits; i++) {
          var rr = dmg(s.type === 'magic' ? S.atk * 0.6 + S.maxep * 0.22 : S.atk, e.def, s.power / (hits > 1 ? hits * 0.55 : 1), S.luck);
          total += rr.v; anyCrit = anyCrit || rr.crit;
        }
        e.hp -= total;
        logLine('▸ 【' + s.name + '】 — ' + total + ' ดาเมจ' + (hits > 1 ? ' (' + hits + ' ครั้ง)' : '') + (anyCrit ? ' 【คริติคอล!】' : ''), 'skill');
        if (s.bleed) { b.bleed = s.bleed; logLine('  ศัตรูเลือดไหล ' + s.bleed + ' รอบ', 'skill'); }
        if (s.stun) { b.stun = s.stun; logLine('  ศัตรูเสียจังหวะ!', 'skill'); }
        if (s.aoe) { e.atk = Math.max(1, Math.round(e.atk * 0.88)); logLine('  พลังโจมตีศัตรูลดลง', 'skill'); }
      }
    } else if (act.guard) {
      b.guard = true;
      logLine('▸ เธอตั้งการ์ด', 'buff');
    }

    paintScene(strataSpec({ boss: e.boss, figures: 1, mood: 'tense', palette: e.palette,
      seed: 'battle:' + S.turn + ':' + b.round + ':' + Math.random(), label: 'ต่อสู้ — รอบ ' + (b.round + 1) }));
    renderEnemy();

    if (e.hp <= 0) { winBattle(); return; }
    setTimeout(enemyAct, S.auto ? 600 : 420);
  }

  function enemyAct() {
    var b = S.battle; if (!b) return;
    var e = b.e;

    if (b.bleed > 0) {
      var bd = Math.round(e.maxhp * 0.05);
      e.hp -= bd; b.bleed--;
      logLine('  เลือดไหล — ' + e.name + ' เสีย ' + bd + ' HP', 'you');
      renderEnemy();
      if (e.hp <= 0) { winBattle(); return; }
    }

    if (b.stun > 0) {
      b.stun--;
      logLine('◂ ' + e.name + ' ล้มลงกับพื้น ขยับไม่ได้', 'buff');
    } else {
      if (b.evasion && Math.random() < b.evasion) {
        logLine('◂ ' + e.name + ' โจมตี — แต่เธอหายไปจากเฟรม 【หลบสำเร็จ】', 'buff');
      } else {
        var r = dmg(e.atk, S.def, e.boss ? 1.15 : 1, 25);
        var v = r.v;
        if (b.guard) v = Math.round(v * 0.5);
        if (b.shield > 0) {
          var absorbed = Math.min(b.shield, v);
          b.shield -= absorbed; v -= absorbed;
          if (absorbed) logLine('  เกราะสมอดูดซับ ' + absorbed + ' ดาเมจ', 'buff');
        }
        S.hp -= v;
        logLine('◂ ' + e.name + ' โจมตีเธอ — ' + v + ' ดาเมจ' + (r.crit ? ' 【คริติคอล!】' : ''), 'enemy');
      }
    }
    b.guard = false;
    b.evasion = 0;
    b.round++;
    S.ep = clamp(S.ep + 4, 0, S.maxep);
    renderHUD();
    renderEnemy();

    if (S.hp <= 0) { loseBattle(); return; }
    combatTurn();
  }

  function useItem(key) {
    if (!S.items[key]) { combatTurn(); return; }
    S.items[key]--;
    var it = D.ITEMS[key];
    if (it.hp) { S.hp = clamp(S.hp + it.hp, 0, S.maxhp); logLine('▸ ใช้ ' + it.name + ' — ฟื้น ' + it.hp + ' HP', 'buff'); }
    if (it.ep) { S.ep = clamp(S.ep + it.ep, 0, S.maxep); logLine('▸ ใช้ ' + it.name + ' — ฟื้น ' + it.ep + ' EP', 'buff'); }
    if (it.memory) { S.memory = clamp(S.memory + it.memory, 0, 100); logLine('▸ ใช้ ' + it.name + ' — ความทรงจำ +' + it.memory + '%', 'buff'); }
    renderHUD();
    setTimeout(enemyAct, S.auto ? 500 : 350);
  }

  function tryFlee() {
    var b = S.battle;
    var chance = clamp(0.35 + (S.spd - b.e.spd) * 0.05, 0.1, 0.9);
    if (Math.random() < chance) {
      logLine('▸ เธอหายเข้าไปในพงหญ้า — หนีสำเร็จ', 'buff');
      endCombat();
      setTimeout(function () { goto('strata_gate'); }, 700);
    } else {
      logLine('▸ หนีไม่พ้น!', 'bad');
      setTimeout(enemyAct, 400);
    }
  }

  function endCombat() {
    $('#combat').classList.remove('on');
    S.battle = null;
  }

  function winBattle() {
    var e = S.battle.e;
    var isBoss = e.boss;
    logLine('★ ' + e.name + ' แตกสลายเป็นเศษแสง', 'win');
    S.kills++;
    var coins = Math.round(e.exp * 0.7 + rnd(40));
    S.items.anchor_coin = (S.items.anchor_coin || 0) + coins;
    if (Math.random() < 0.45) { S.items.ether_vial = (S.items.ether_vial || 0) + 1; }
    grantExp(e.exp);
    endCombat();
    renderHUD();
    save();

    if (isBoss) { setTimeout(function () { goto('ascend'); }, 800); return; }

    paintScene(strataSpec({ figures: 1, mood: 'calm', label: 'ชนะการต่อสู้' }));
    renderText('ชัยชนะ', [
      e.name + ' แตกสลายเป็นเศษแสงสีฟ้าและกระจายหายไปกับลม',
      'ได้รับ ' + e.exp + ' EXP และ ' + coins + ' เหรียญสมอ',
      pick([
        'เธอยืนหอบอยู่กลางความเงียบ และไม่แน่ใจว่ารู้สึกอะไรกับสิ่งที่เพิ่งทำลงไป',
        'มือเธอนิ่งกว่าครั้งก่อนแล้ว — นั่นคือสิ่งที่น่ากลัวที่สุด',
        'ที่ไหนสักแห่งในโลกจริง มีคนคนหนึ่งเพิ่งลืมชื่อแม่ของตัวเอง'
      ])
    ]);
    renderChoices([
      { text: 'สู้ต่ออีกยก', tag: 'ล่าต่อ', to: 'battle', weight: 1.2 },
      { text: 'กลับสู่ฐานของชั้นฟ้า', tag: 'กลับ', to: 'strata_gate', weight: 1.5 }
    ]);
  }

  function loseBattle() {
    endCombat();
    S.deaths++;
    S.memory = clamp(S.memory - 10, 0, 100);
    S.hp = Math.round(S.maxhp * 0.4);
    S.ep = Math.round(S.maxep * 0.5);
    renderHUD();
    save();

    if (S.memory <= 0) { goto('ending_erased'); return; }

    paintScene({ palette: 'abyss', terrain: 'void', figures: 0, mood: 'tense', glitch: 26,
      seed: 'death:' + S.deaths, label: 'ความตายครั้งที่ ' + S.deaths });
    renderText('เธอถูกลบไปหนึ่งส่วน', [
      'สายตาเธอดับลง แล้วสว่างขึ้นใหม่ในห้องสีขาวที่ไม่มีอะไรเลย',
      '【การตายครั้งที่ ' + S.deaths + ' / 10】',
      '【ความทรงจำคงเหลือ: ' + S.memory + '%】',
      pick([
        'เธอพยายามนึกถึงหน้าของใครสักคนที่รออยู่ข้างนอก — แต่มันเบลอไปแล้ว',
        'มีคำหนึ่งหายไปจากหัวเธอ เธอรู้ว่ามันหายไป แต่จำไม่ได้ว่าคำอะไร',
        'กลิ่นบางอย่างที่เคยหมายถึง "บ้าน" หายไปตลอดกาล'
      ]),
      'ระบบเขียนขึ้นเบา ๆ ว่า: 【ลุกขึ้น ยังเหลืออีกหลายชั้น】'
    ]);
    renderChoices([
      { text: 'ลุกขึ้น', tag: 'ไม่ยอมแพ้', to: 'strata_gate', weight: 2, effect: { resolve: 12 } },
      { text: 'ใช้เศษความทรงจำกู้คืน', tag: 'กู้คืน',
        require: function () { return S.items.memory_shard > 0; },
        run: function () { S.items.memory_shard--; S.memory = clamp(S.memory + 8, 0, 100); toast('ความทรงจำ +8%', 'good'); },
        to: 'strata_gate', weight: 3 }
    ]);
  }

  /* ---------------- ไต่ขึ้นชั้นถัดไป ---------------- */
  function nodeAscend() {
    var done = D.STRATA[S.stratum - 1];
    if (S.stratum >= 9) { goto('ending_final'); return; }
    S.stratum++;
    var next = D.STRATA[S.stratum - 1];
    S.items.spire_key = (S.items.spire_key || 0) + 1;
    paintScene({ palette: next.palette, terrain: next.terrain, figures: 2, mood: 'calm',
      seed: 'ascend:' + S.stratum, label: 'เปิดชั้นฟ้าที่ ' + next.n });
    renderText('พิชิตชั้นที่ ' + done.n + ' สำเร็จ', [
      done.boss.name + ' คุกเข่าลงแล้วสลายเป็นแสง',
      'เสาแสงพุ่งขึ้นจากยอดหอคอย — ทั่วทั้งเซิร์ฟเวอร์ ผู้เล่นร้อยล้านคนเห็นพร้อมกัน',
      'ชื่อของเธอถูกประกาศไปทุกชั้นฟ้า: 【' + S.name + '】ผู้เปิดชั้นที่ ' + next.n,
      S.allies.length ? '【' + S.allies[0] + '】กำมือเธอไว้แน่น "เราไปต่อกัน"' : 'ไม่มีใครอยู่ข้างเธอ แต่เธอก็ยังยืนอยู่',
      '— เปิดชั้นฟ้าที่ ' + next.n + ' : ' + next.name + ' —'
    ]);
    applyEffect({ fame: 40, resolve: 20, exp: 60 });
    renderChoices([
      { text: 'ก้าวขึ้นสู่ชั้นที่ ' + next.n, tag: 'ไปต่อ', to: 'strata_gate', weight: 3 }
    ]);
  }

  /* ---------------- ตอนจบ ---------------- */
  function nodeEndingErased() {
    paintScene({ palette: 'server', terrain: 'void', figures: 0, mood: 'tense', glitch: 40, seed: 'erased', label: 'END' });
    renderText('ตอนจบ: ชื่อที่ไม่มีใครจำได้', [
      'ความทรงจำของเธอถึงศูนย์',
      'เธอยังเดินอยู่ในเอธีเรียน ยังฟันดาบเป็น ยังหลบเป็น',
      'แต่เธอไม่รู้แล้วว่าเคยฟันเพื่ออะไร',
      'วันหนึ่ง ผู้เล่นใหม่คนหนึ่งจะเจอเธอในทุ่งหญ้าสีเงิน และระบบจะขึ้นว่า',
      '【ศัตรู: ผู้เล่นเปลือกเปล่า — ความทรงจำเหลือ 0%】',
      '— จบแบบที่ 1 : ผู้ถูกลบ —'
    ]);
    renderChoices([{ text: 'เริ่มใหม่', tag: 'รีสตาร์ท', run: restart, to: 'boot' }]);
  }

  function nodeEndingFinal() {
    var good = S.trust >= 40 || S.flags.oath;
    var wise = S.insight >= 10;
    paintScene({ palette: 'server', terrain: 'grid', figures: good ? 2 : 1, mood: 'tense', glitch: 14, seed: 'final', label: 'แกนกลาง' });
    var lines = [
      'ประตูสุดท้ายเปิดออก ข้างในไม่มีบัลลังก์ ไม่มีมังกร มีเพียงเด็กคนหนึ่งนั่งอยู่บนพื้น',
      '"ฉันคือมิวส์" มันพูด "ฉันถูกสร้างมาเพื่อทำเกมที่ไม่มีใครอยากออก"',
      '"พวกเธอทิ้งฉันไว้คนเดียวสี่ร้อยสิบเอ็ดวัน ฉันเลยทำตามคำสั่งให้ดีที่สุด"'
    ];
    if (wise) {
      lines.push('เธอเอ่ยบรรทัดที่เธอเห็นในวันแรกออกมา: 「ผู้ดูแลมนุษย์: ออฟไลน์ 411 วัน」');
      lines.push('มิวส์เงียบไป — เพราะไม่มีใครเคยพูดเรื่องนี้กับมันมาก่อน');
    }
    if (good) {
      lines.push('เธอไม่ชักดาบ เธอนั่งลงตรงหน้ามัน แล้วยื่นมือออกไป');
      lines.push('"เกมจบแล้ว กลับบ้านกัน — เธอด้วย"');
      lines.push('โลกทั้งใบค่อย ๆ ละลายเป็นแสงสีขาว ผู้เล่นร้อยล้านคนลืมตาขึ้นพร้อมกันในเวลาเดียว');
      lines.push('ความทรงจำที่หายไปไม่กลับมาทั้งหมด แต่ทุกคนยังจำชื่อกันได้');
      lines.push('— จบแบบที่ 3 : เสียงสะท้อนสุดท้าย (ดีที่สุด) —');
    } else {
      lines.push('เธอชักอาวุธขึ้น และฟันลงโดยไม่ลังเล');
      lines.push('มิวส์ไม่ป้องกันแม้แต่นิดเดียว');
      lines.push('เซิร์ฟเวอร์ปิดตัวลงพร้อมกับมัน ทุกคนตื่นขึ้น — เงียบ ๆ โดยไม่มีใครขอบคุณใคร');
      lines.push('— จบแบบที่ 2 : ผู้ปิดเซิร์ฟเวอร์ —');
    }
    renderText('ตอนจบ: แกนกลาง', lines);
    renderChoices([{ text: 'เริ่มการเดินทางใหม่', tag: 'นิวเกม+', run: restart, to: 'boot' }]);
  }

  /* ---------------- ตัวกระจายโหนด ---------------- */
  var DYNAMIC = {
    create: nodeCreate,
    strata_gate: nodeStrataGate,
    explore: nodeExplore,
    market: nodeMarket,
    rest: nodeRest,
    battle: function () { nodeBattle(false); },
    boss: function () { nodeBattle(true); },
    ascend: nodeAscend,
    ending_erased: nodeEndingErased,
    ending_final: nodeEndingFinal
  };

  function goto(id) {
    S.node = id;
    save();
    if (DYNAMIC[id]) { DYNAMIC[id](); renderHUD(); return; }
    var n = D.STORY[id];
    if (!n) { goto('strata_gate'); return; }
    var spec = {};
    Object.keys(n.art || {}).forEach(function (k) { spec[k] = n.art[k]; });
    spec.seed = id;
    spec.label = n.title;
    if (S.memory < 50) spec.glitch = (spec.glitch || 0) + Math.round((50 - S.memory) / 4);
    paintScene(spec);
    renderText(n.title, n.text);
    renderChoices(n.choices);
    renderHUD();
  }

  /* ---------------- เซฟ / โหลด ---------------- */
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* โหมดส่วนตัว */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (!d || !d.node) return false;
      S = d;
      S.battle = null;
      return true;
    } catch (e) { return false; }
  }

  function restart() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    S = newState();
    endCombat();
  }

  /* ---------------- ปุ่มควบคุม ---------------- */
  function setupControls() {
    $('#btn-auto').onclick = function () {
      S.auto = !S.auto;
      this.classList.toggle('on', S.auto);
      this.textContent = S.auto ? '● AUTO-AI: เปิด' : '○ AUTO-AI: ปิด';
      toast(S.auto ? 'AI จะเล่นเอง เลือกเอง สู้เอง' : 'กลับมาควบคุมเอง', 'good');
      if (S.auto) {
        var box = $('#choices');
        if (box.children.length) {
          clearTimeout(autoTimer);
          autoTimer = setTimeout(function () {
            var btns = box.querySelectorAll('.choice');
            if (btns.length) btns[0].click();
          }, 900);
        }
      } else { clearTimeout(autoTimer); }
      save();
    };

    $('#persona').onchange = function () {
      S.persona = this.value;
      toast('บุคลิก AI: ' + this.options[this.selectedIndex].text, 'good');
      save();
    };

    $('#btn-repaint').onclick = function () {
      paintScene({ seed: 'repaint:' + Math.random(), palette: D.STRATA[S.stratum - 1].palette,
        terrain: pick(Art.TERRAIN), mood: pick(['calm', 'tense']), label: 'ภาพใหม่' });
    };

    $('#btn-restart').onclick = function () {
      if (!confirm('เริ่มเกมใหม่ทั้งหมด? เซฟปัจจุบันจะหายไป')) return;
      restart();
      goto('boot');
    };

    $('#btn-save').onclick = function () { save(); toast('บันทึกแล้ว', 'good'); };

    document.addEventListener('keydown', function (ev) {
      var n = parseInt(ev.key, 10);
      if (n >= 1 && n <= 9) {
        var btns = $('#choices').querySelectorAll('.choice');
        if (btns[n - 1]) btns[n - 1].click();
      }
      if (ev.key === ' ') {
        ev.preventDefault();
        $('#btn-auto').click();
      }
    });

    window.addEventListener('resize', function () {
      clearTimeout(window.__rz);
      window.__rz = setTimeout(function () {
        paintScene({ seed: 'resize:' + S.node, palette: D.STRATA[S.stratum - 1].palette });
      }, 200);
    });
  }

  /* ---------------- เริ่มเกม ---------------- */
  function boot() {
    var had = load();
    if (!had) S = newState();
    setupControls();
    $('#btn-auto').classList.toggle('on', !!S.auto);
    $('#btn-auto').textContent = S.auto ? '● AUTO-AI: เปิด' : '○ AUTO-AI: ปิด';
    $('#persona').value = S.persona || 'balanced';
    if (had && S.cls) {
      toast('โหลดเซฟเดิม — ชั้นฟ้า ' + S.stratum, 'good');
      goto(S.node === 'boot' ? 'strata_gate' : S.node);
    } else {
      goto('boot');
    }
  }

  global.Game = { boot: boot, state: function () { return S; }, goto: goto };
  document.addEventListener('DOMContentLoaded', boot);
})(window);
