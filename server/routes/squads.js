'use strict';
const express = require('express');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generateTroopers } = require('../utils/generateTroopers');
const { createSeed, seededRng, todayString } = require('../utils/seed');

const router = express.Router();

const OPPONENT_COUNT = 8;
const FAKE_SQUAD_NAMES = [
  'Wolves','Cobra','Phantom','Iron','Viper','Sentinels','Black Hawks','Falcons',
  'Reapers','Crimson','Steel Owls','Nightshade','Rogue','Tempete','Spectre',
  'Garde Noire','Lions','Vautours','Sangliers','Fer de Lance'
];

function safeConfig(raw) {
  try {
    const cfg = JSON.parse(raw || '{}');
    return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : null;
  } catch (_) { return null; }
}

function founderSoldier(squad) {
  const config = safeConfig(squad.founderConfig);
  if (!config) return null;
  const unlockedWeapons = [];
  if (squad.founderSkill1) unlockedWeapons.push(squad.founderSkill1);
  if (squad.founderSkill2 && squad.founderSkill2 !== squad.founderSkill1) unlockedWeapons.push(squad.founderSkill2);
  return {
    id: 'srv-founder-' + squad.id,
    name: squad.founderName || 'Soldat',
    config,
    level: 1,
    xp: 0,
    unlockedWeapons,
    preferredWeapon: squad.founderSkill1 || null,
  };
}

// GET /api/squad/opponents/list — public: player armies available for matchmaking.
// Until full HQ sync exists server-side, each registered squad exposes its founder.
function calcSoldierPower(soldier) {
  return 4 + Math.max(1, Number(soldier && soldier.level) || 1);
}

function calcSquadPower(soldiers) {
  return soldiers.reduce((sum, s) => sum + calcSoldierPower(s), 0);
}

function calcSquadLevel(soldiers) {
  const total = soldiers.reduce((s, x) => s + (x.level || 1), 0);
  return Math.max(1, 1 + Math.floor((total + soldiers.length) / 4));
}

function getPowerTiers(myPower) {
  const p = Math.max(5, Number(myPower) || 5);
  const raw = p <= 10
    ? [5, 6, 7, 8, 12, 18, 28, 40]
    : [5, p * 0.45, p * 0.7, p * 0.9, p, p * 1.25, p * 1.7, p * 2.4];
  const tiers = [];
  for (const value of raw) {
    const rounded = Math.max(5, Math.round(value));
    if (!tiers.includes(rounded)) tiers.push(rounded);
  }
  return tiers.sort((a, b) => a - b).slice(0, OPPONENT_COUNT);
}

function soldierFromGenerated(gen) {
  const unlockedWeapons = [];
  if (gen.skill1Name) unlockedWeapons.push(gen.skill1Name);
  if (gen.skill2Name && gen.skill2Name !== gen.skill1Name) unlockedWeapons.push(gen.skill2Name);
  return {
    id: gen.id,
    name: gen.name,
    config: gen.config,
    level: 1,
    xp: 0,
    unlockedWeapons,
    preferredWeapon: gen.skill1Name || null,
  };
}

function applyTargetPower(soldiers, targetPower, rng) {
  const target = Math.max(5, Math.round(targetPower));
  let bonus = Math.max(0, target - (soldiers.length * 5));
  for (const s of soldiers) s.level = 1;
  let guard = 0;
  while (bonus > 0 && guard++ < 400) {
    const idx = Math.floor(rng() * soldiers.length);
    soldiers[idx].level += 1;
    bonus -= 1;
  }
}

function buildBotSquad(seed, targetPower) {
  const day = todayString();
  const rng = seededRng(createSeed(day, seed));
  const wantedPower = Math.max(5, Math.round(targetPower || 5));
  const count = Math.max(1, Math.min(8, Math.floor(wantedPower / 5)));
  const soldiers = generateTroopers(seed, day, count).map(soldierFromGenerated);
  const uniformIdx = Math.floor(rng() * 10);
  for (const s of soldiers) {
    s.config = { ...s.config, uniformIdx };
  }
  applyTargetPower(soldiers, wantedPower, rng);
  const name = FAKE_SQUAD_NAMES[Math.floor(rng() * FAKE_SQUAD_NAMES.length)] +
    ' #' + Math.floor(100 + rng() * 900);
  return {
    name,
    botId: 'srv-bot-' + createSeed(day, seed).toString(36),
    soldiers,
    power: calcSquadPower(soldiers),
    level: calcSquadLevel(soldiers),
    source: 'bot',
  };
}

function buildBotOpponents(myPower, excludedBotIds, cycle) {
  const excluded = new Set(String(excludedBotIds || '').split(',').filter(Boolean));
  const day = todayString();
  const matchCycle = Math.max(0, Number(cycle) || 0);
  return getPowerTiers(myPower).map((tier, idx) => {
    let fallback = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const seed = 'match-bot|' + day + '|' + matchCycle + '|' + Math.round(myPower || 5) + '|' + idx + '|' + attempt;
      const bot = buildBotSquad(seed, tier);
      fallback = bot;
      if (!excluded.has(bot.botId) && !excluded.has(bot.name)) return bot;
    }
    return fallback;
  });
}

// The response mixes registered player squads with generated bot squads so sparse
// lobbies still cover low, even, and high power brackets.
router.get('/opponents/list', (req, res) => {
  const exclude = String(req.query.exclude || '').trim().toLowerCase();
  const myPower = Math.max(5, Number(req.query.power) || 5);
  const cycle = Math.max(0, Number(req.query.cycle) || 0);
  const playerSquads = db.listSquads()
    .filter(s => String(s.name || '').toLowerCase() !== exclude)
    .map(s => {
      const founder = founderSoldier(s);
      if (!founder) return null;
      return {
        name: s.name,
        soldiers: [founder],
        power: 5,
        level: 1,
        source: 'player',
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.power - b.power || a.name.localeCompare(b.name))
    .slice(0, 50);
  const botSquads = buildBotOpponents(myPower, req.query.excludeBots, cycle);
  const squads = [...playerSquads, ...botSquads];

  return res.json({ squads });
});

// POST /api/squad/soldier-upgrade — authed: notify server that a soldier paid to
// level up. The server doesn't yet hold per-soldier state, so this is a hook
// for future ledger logic. We accept the event, log it, and acknowledge.
router.post('/soldier-upgrade', requireAuth, (req, res) => {
  const body = req.body || {};
  const soldierId = String(body.soldierId || '').slice(0, 64);
  const fromLevel = Number(body.fromLevel) | 0;
  const toLevel   = Number(body.toLevel) | 0;
  const cost      = Number(body.cost) | 0;
  if (!soldierId || toLevel <= fromLevel || cost < 0) {
    return res.status(400).json({ error: 'Paramètres invalides.' });
  }
  console.log(`[squadron-server] upgrade ack squad="${req.squadName}" soldier="${soldierId}" ${fromLevel}→${toLevel} cost=${cost}`);
  return res.json({ ok: true });
});

// GET /api/squad/:name — public: does this squad exist? does it have a password?
router.get('/:name', (req, res) => {
  const name = String(req.params.name || '').trim().slice(0, 24);
  if (name.length < 2) return res.status(400).json({ error: 'Nom invalide.' });

  const squad = db.findByName(name);
  if (!squad) return res.json({ exists: false, hasPassword: false });

  return res.json({
    exists:      true,
    hasPassword: !!(squad.passwordHash && squad.passwordHash.length > 0),
  });
});

module.exports = router;
