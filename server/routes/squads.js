'use strict';
const express = require('express');
const db      = require('../db');

const router = express.Router();

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
