'use strict';
const express   = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const db        = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS } = require('../config');
const { isSecurePassword } = require('../utils/password');

const router = express.Router();

function sanitizeName(s) {
  return String(s || '').trim().replace(/[<>"'`]/g, '').slice(0, 24);
}

function signToken(squadId, squadName) {
  return jwt.sign({ squadId, squadName }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'squadron',
  });
}

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('squadName').isString().notEmpty().isLength({ min: 2, max: 24 }),
    body('password').isString().isLength({ max: 128 }),
    body('founder').isObject(),
    body('founder.name').isString().notEmpty().isLength({ max: 64 }),
    body('founder.config').isObject(),
    body('founder.skill1Name').isString().notEmpty().isLength({ max: 64 }),
    body('founder.skill2Name').isString().notEmpty().isLength({ max: 64 }),
  ],
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: 'Données invalides.' });
    }

    const squadName = sanitizeName(req.body.squadName);
    if (squadName.length < 2) {
      return res.status(400).json({ error: 'Le nom doit faire au moins 2 caractères.' });
    }

    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const { founder } = req.body;

    if (typeof founder.config !== 'object' || Array.isArray(founder.config)) {
      return res.status(400).json({ error: 'Données invalides.' });
    }

    if (db.findByName(squadName)) {
      return res.status(409).json({ error: 'Une squad avec ce nom existe déjà.' });
    }

    const passwordHash = password.length > 0
      ? await bcrypt.hash(password, BCRYPT_ROUNDS)
      : '';

    // Silently mark weak passwords — no feedback to client
    const isSecure = isSecurePassword(password) ? 1 : 0;

    let squadId;
    try {
      squadId = db.insertSquad({
        name:         squadName,
        passwordHash,
        founderName:  String(founder.name).slice(0, 64),
        founderConfig: JSON.stringify(founder.config),
        founderSkill1: String(founder.skill1Name).slice(0, 64),
        founderSkill2: String(founder.skill2Name).slice(0, 64),
        isSecure,
      });
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Une squad avec ce nom existe déjà.' });
      }
      console.error('register error:', e.message);
      return res.status(500).json({ error: 'Erreur serveur.' });
    }

    return res.status(201).json({ token: signToken(squadId, squadName), squadName });
  },
);

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('squadName').isString().notEmpty().isLength({ min: 2, max: 24 }),
    body('password').isString().isLength({ max: 128 }),
  ],
  async (req, res) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: 'Données invalides.' });
    }

    const squadName = sanitizeName(req.body.squadName);
    const password  = typeof req.body.password === 'string' ? req.body.password : '';

    const squad = db.findByName(squadName);
    if (!squad) {
      // Constant-time dummy hash to prevent username enumeration
      await bcrypt.hash('___dummy___', BCRYPT_ROUNDS);
      return res.status(401).json({ error: 'ACCESS DENIED — squad introuvable.' });
    }

    // No password set → free access
    if (!squad.passwordHash || squad.passwordHash.length === 0) {
      return res.json({ token: signToken(squad.id, squad.name), squadName: squad.name });
    }

    const match = await bcrypt.compare(password, squad.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'ACCESS DENIED — mot de passe invalide.' });
    }

    return res.json({ token: signToken(squad.id, squad.name), squadName: squad.name });
  },
);

module.exports = router;
