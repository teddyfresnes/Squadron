'use strict';
const express = require('express');
const db      = require('../db');

const router = express.Router();

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
router.get('/opponents/list', (req, res) => {
  const exclude = String(req.query.exclude || '').trim().toLowerCase();
  const squads = db.listSquads()
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

  return res.json({ squads });
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
