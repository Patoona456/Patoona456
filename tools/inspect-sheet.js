#!/usr/bin/env node
/**
 * What shape is this sheet, actually?
 *
 *   npm run sheet -- path/to/art.png [more.png ...]
 *
 * Art arrives on whatever grid it was drawn on, and the difference between a
 * sheet that works and one that renders somebody else's feet is a handful of
 * numbers nobody can read off a picture by eye. This reads the PNG header for
 * the true size and then suggests the grids that divide it cleanly, so the
 * layout entry can be written from fact rather than from a guess.
 *
 * It reads the IHDR chunk directly - no image library, because this project
 * does not have one and a sheet's dimensions are the first 24 bytes.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LPC, fits } from '../shared/sheets.js';

/** Width and height from a PNG's IHDR, which is always the first chunk. */
export function pngSize(buf) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buf.length < 24 || signature.some((b, i) => buf[i] !== b)) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Frame sizes that divide the sheet cleanly, most plausible first. */
export function candidates({ width, height }) {
  const out = [];
  for (let w = 16; w <= Math.min(width, 512); w += 1) {
    if (width % w) continue;
    for (const h of new Set([w, Math.round(w * 1.5), w * 2])) {
      if (h < 16 || h > height || height % h) continue;
      const cols = width / w, rows = height / h;
      if (cols < 2 || rows < 1 || cols > 64 || rows > 64) continue;
      out.push({ frame: { w, h }, cols, rows, square: w === h });
    }
  }
  // Square frames first, then the ones whose row count divides by four - a
  // sheet with four rows per action is almost always a four-direction sheet.
  return out.sort((a, b) =>
    (b.square - a.square) || ((b.rows % 4 === 0) - (a.rows % 4 === 0)) || (a.cols - b.cols));
}

const files = process.argv.slice(2);
if (!files.length) {
  console.log('ใช้: npm run sheet -- path/to/art.png [เพิ่มได้อีก]');
  process.exit(1);
}
for (const file of files) {
  let size;
  try { size = pngSize(await readFile(file)); } catch (e) { console.log(`${file}: อ่านไม่ได้ (${e.code ?? e.message})`); continue; }
  if (!size) { console.log(`${file}: ไม่ใช่ PNG ที่อ่าน header ได้`); continue; }
  console.log(`\n${path.basename(file)}  ${size.width}x${size.height}`);
  if (fits(LPC, size.width, size.height)) {
    console.log('  ตรงกับ LPC พอดี — วางลง assets/lpc/ ได้เลย ไม่ต้องประกาศ layout');
    continue;
  }
  console.log(`  ไม่ตรงกับ LPC (${LPC.frame.w * LPC.cols}x${LPC.frame.h * LPC.rows}) — เลย์เอาต์ที่เป็นไปได้:`);
  const best = candidates(size).slice(0, 6);
  if (!best.length) { console.log('    หากริดที่ลงตัวไม่ได้เลย ขนาดอาจไม่ได้หารลงตัว'); continue; }
  for (const c of best) {
    console.log(`    เฟรม ${c.frame.w}x${c.frame.h}  =  ${c.cols} คอลัมน์ x ${c.rows} แถว`
      + (c.rows % 4 === 0 ? '   (แถวหาร 4 ลงตัว — น่าจะ 4 ทิศ)' : ''));
  }
  const top = best[0];
  console.log('\n  ประกาศแบบนี้ใน shared/sheets.js:');
  console.log(`    defineLayout('${path.basename(file, '.png')}', {`);
  console.log(`      frame: { w: ${top.frame.w}, h: ${top.frame.h} }, cols: ${top.cols}, rows: ${top.rows},`);
  console.log('      dirRows: 4,   // หรือ 1 ถ้าชีตนี้มีทิศเดียว');
  console.log(`      anims: { walk: { row: 0, frames: ${top.cols}, fps: 10 }, idle: { row: 0, frames: 1, fps: 1 } },`);
  console.log('    });');
}
console.log('');
