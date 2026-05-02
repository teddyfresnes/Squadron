'use strict';
const fs   = require('fs');
const path = require('path');
const { DB_PATH } = require('./config');

// Pure-JS JSON store — no native modules, atomically flushed to disk.
const FILE = DB_PATH.replace(/\.db$/, '.json');

let _mem = null;

function load() {
  if (_mem) return _mem;
  try { _mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) {}
  if (!_mem || !Array.isArray(_mem.squads)) _mem = { squads: [], nextId: 1 };
  return _mem;
}

function persist() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_mem, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

// Case-insensitive name lookup
function findByName(name) {
  const lo = name.toLowerCase();
  return load().squads.find(s => s.name.toLowerCase() === lo) || null;
}

// Returns inserted id; throws { code: 'SQLITE_CONSTRAINT_UNIQUE' } on duplicate
function insertSquad({ name, passwordHash, founderName, founderConfig, founderSkill1, founderSkill2, isSecure }) {
  const d = load();
  if (findByName(name)) {
    throw Object.assign(new Error('Duplicate squad name'), { code: 'SQLITE_CONSTRAINT_UNIQUE' });
  }
  const id = d.nextId++;
  d.squads.push({ id, name, passwordHash, founderName, founderConfig, founderSkill1, founderSkill2, isSecure, createdAt: Date.now() });
  persist();
  return id;
}

module.exports = { findByName, insertSquad };
