// Browser stand-in for the three node:crypto functions accounts.js uses.
// This demo runs entirely on the player's own machine and the "password"
// never leaves the page, so a fast non-cryptographic digest is enough here.
// The real server keeps using scrypt.
function digest(input, salt, len) {
  const data = `${salt}|${input}`;
  const out = new Uint8Array(len);
  let h1 = 0x811c9dc5, h2 = 0x1000193 ^ salt.length;
  for (let pass = 0; pass < len; pass++) {
    for (let i = 0; i < data.length; i++) {
      h1 = Math.imul(h1 ^ data.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 + data.charCodeAt(i) + pass, 2246822519) >>> 0;
      h1 = ((h1 << 13) | (h1 >>> 19)) >>> 0;
    }
    out[pass] = (h1 ^ h2) & 255;
  }
  return out;
}

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

export function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return { toString: () => hex(b) };
}

export function scryptSync(password, salt, len) {
  const b = digest(String(password), String(salt), len);
  return { toString: () => hex(b) };
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export default { randomBytes, scryptSync, timingSafeEqual };
