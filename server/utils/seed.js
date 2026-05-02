'use strict';

// MurmurHash3-inspired 32-bit finalizer — fast, good avalanche
function hashString(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) >>> 0;
}

// Deterministic seed from date string (YYYY-MM-DD) and client IP
function createSeed(dateStr, ip) {
  return hashString(dateStr + '|' + normalizeIp(ip));
}

// Mulberry32 — small, fast, high quality seeded PRNG
function seededRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return 'unknown';
  const v4 = ip.replace(/^::ffff:/, '');
  if (v4 === '::1') return '127.0.0.1';
  return v4.split(',')[0].trim();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { createSeed, seededRng, normalizeIp, todayString };
